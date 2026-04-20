'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { normalizePhone } from '@/lib/phone';
import { useQuery } from '@tanstack/react-query';
import { useSymptoms, type SymptomCode } from '@/hooks/use-symptoms';
import { useVehicleWarrantyCoverage } from '@/hooks/use-warranty';

interface CaptureSession {
  id: string;
  token: string;
  captureUrl: string;
  status: string;
  capture_mode: string;
}
interface CapturePhoto { photo_type: string; storage_url: string; captured_at: string }

// ── Types ────────────────────────────────────────────────────
interface Customer { id: string; full_name: string; phone: string; email: string | null }
interface Vehicle { id: string; plate: string; make: string; model: string; year: number | null; vin: string | null; customer_id: string; mileage?: number }
interface Make { id: string; name: string; country: string | null }
interface Model { id: string; name: string; body_type: string | null }
interface DviItem { name: string; category: string; status: string; notes: string }
interface DamageEntry { location: string; type: string; description?: string; severity?: string }
interface CatalogItem { id: string; name: string; code: string | null; category: string | null; type: string; estimated_hours: number | null; quick_access: boolean }

type Step = 'entry' | 'vehicle' | 'inspection' | 'damage' | 'photos' | 'accessories' | 'problem' | 'repairs' | 'review';

const STEPS: { key: Step; label: string }[] = [
  { key: 'entry', label: '1. Vehicle & Customer' },
  { key: 'inspection', label: '2. Vehicle Data' },
  { key: 'damage', label: '3. Damage Map' },
  { key: 'photos', label: '4. Walk-Around Photos' },
  { key: 'accessories', label: '5. Accessories' },
  { key: 'problem', label: '6. Symptoms' },
  { key: 'repairs', label: '7. Repair Items' },
  { key: 'review', label: '8. Review & Create' },

];

const REQUIRED_PHOTOS = [
  { key: 'front', label: 'Front View', desc: 'Full front of vehicle including bumper and lights' },
  { key: 'rear', label: 'Rear View', desc: 'Full rear including bumper and lights' },
  { key: 'left', label: 'Left Side', desc: 'Full left side from mirror to rear wheel' },
  { key: 'right', label: 'Right Side', desc: 'Full right side from mirror to rear wheel' },
  { key: 'dashboard', label: 'Dashboard / Odometer', desc: 'Dashboard showing the odometer reading' },
  { key: 'interior', label: 'Interior', desc: 'Full interior from open driver door' },
];

const FUEL_LEVELS = ['empty', 'quarter', 'half', 'three_quarter', 'full'] as const;

const DEFAULT_DVI: DviItem[] = [
  { name: 'Brake Pads - Front', category: 'brakes', status: 'not_inspected', notes: '' },
  { name: 'Brake Pads - Rear', category: 'brakes', status: 'not_inspected', notes: '' },
  { name: 'Brake Discs', category: 'brakes', status: 'not_inspected', notes: '' },
  { name: 'Engine Oil', category: 'engine', status: 'not_inspected', notes: '' },
  { name: 'Coolant', category: 'engine', status: 'not_inspected', notes: '' },
  { name: 'Drive Belts', category: 'engine', status: 'not_inspected', notes: '' },
  { name: 'Battery', category: 'electrical', status: 'not_inspected', notes: '' },
  { name: 'Shocks - Front', category: 'suspension', status: 'not_inspected', notes: '' },
  { name: 'Shocks - Rear', category: 'suspension', status: 'not_inspected', notes: '' },
  { name: 'Tires - FL', category: 'tires', status: 'not_inspected', notes: '' },
  { name: 'Tires - FR', category: 'tires', status: 'not_inspected', notes: '' },
  { name: 'Tires - RL', category: 'tires', status: 'not_inspected', notes: '' },
  { name: 'Tires - RR', category: 'tires', status: 'not_inspected', notes: '' },
  { name: 'Headlights', category: 'lights', status: 'not_inspected', notes: '' },
  { name: 'Wipers', category: 'body', status: 'not_inspected', notes: '' },
  { name: 'A/C System', category: 'hvac', status: 'not_inspected', notes: '' },
  { name: 'Exhaust', category: 'exhaust', status: 'not_inspected', notes: '' },
];

// ── Component ────────────────────────────────────────────────
export default function NewJobWizard() {
  const tc = useTranslations('common');
  const router = useRouter();

  // Step management
  const [step, setStep] = useState<Step>('entry');
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // Entry mode
  const [entryMode, setEntryMode] = useState<'vehicle' | 'customer' | null>(null);

  // Customer & Vehicle
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [plateSearch, setPlateSearch] = useState('');

  // Comeback detection — fires whenever a vehicle is selected
  const [isComeback, setIsComeback] = useState(false);
  const [comebackOriginalJobId, setComebackOriginalJobId] = useState<string>('');
  const [comebackReason, setComebackReason] = useState('');
  const { data: warrantyCoverage } = useVehicleWarrantyCoverage(selectedVehicle?.id ?? '');
  const hasActiveWarranty = (warrantyCoverage?.active_coverage?.length ?? 0) > 0;
  const recentJobs = warrantyCoverage?.comeback_candidates ?? [];
  const hasRecentJobs = recentJobs.length > 0;

  // New vehicle form
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ plate: '', vin: '', makeId: '', make: '', model: '', year: '', color: '', fuelType: 'diesel' });
  const [selectedMakeId, setSelectedMakeId] = useState('');

  // Inspection
  const [mileage, setMileage] = useState('');
  const [fuelLevel, setFuelLevel] = useState('');
  const [dviItems, setDviItems] = useState<DviItem[]>([...DEFAULT_DVI]);
  const [damages, setDamages] = useState<DamageEntry[]>([]);
  const [damageZone, setDamageZone] = useState<string | null>(null);
  const [damageType, setDamageType] = useState('scratch');
  const [damageDesc, setDamageDesc] = useState('');
  // Keys
  const [keyType, setKeyType] = useState('standard');
  const [keysReceived, setKeysReceived] = useState('1');

  // Accessories checklist: status per item
  const [safetyItems, setSafetyItems] = useState<Record<string, string>>({
    jack: 'na', jack_handle: 'na', spare_tire: 'na', warning_triangle: 'na',
    reflective_vest: 'na', fire_extinguisher: 'na', first_aid_kit: 'na',
  });
  const [accessoryItems, setAccessoryItems] = useState<Record<string, string>>({
    floor_mats: 'na', hubcaps: 'na', antenna: 'na', wiper_blades: 'na',
    roof_rack: 'na', tow_bar: 'na', mud_flaps: 'na',
  });
  const [belongings, setBelongings] = useState<Array<{ label: string; detail: string }>>([]);
  const [newBelonging, setNewBelonging] = useState('');

  // Mileage validation
  const [mileageError, setMileageError] = useState('');
  const handleMileageChange = (val: string) => {
    setMileage(val);
    const km = Number(val);
    if (selectedVehicle?.mileage != null && km > 0 && km < selectedVehicle.mileage) {
      setMileageError(`Cannot be lower than last recorded: ${selectedVehicle.mileage.toLocaleString()} km`);
    } else {
      setMileageError('');
    }
  };

  // Walk-around photos (file uploads)
  const [vehiclePhotos, setVehiclePhotos] = useState<Record<string, File | null>>({});
  const localPhotoCount = Object.values(vehiclePhotos).filter(Boolean).length;

  // WhatsApp photo capture session (draft — no job card yet)
  const [captureSession, setCaptureSession] = useState<CaptureSession | null>(null);
  const [remotePhotos, setRemotePhotos] = useState<CapturePhoto[]>([]);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [whatsAppSent, setWhatsAppSent] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [sendChannel, setSendChannel] = useState<'whatsapp' | 'sms'>('whatsapp');

  // Photo policy setting: 'strict' = must have photos before creation, 'flexible' = can skip
  const [photoPolicy, setPhotoPolicy] = useState<'strict' | 'flexible'>('strict');

  // Total photos = local uploads + remote (WhatsApp) captures
  const remotePhotoTypes = new Set(remotePhotos.map((p) => p.photo_type));
  const photoCount = localPhotoCount + [...remotePhotoTypes].filter((t) => !vehiclePhotos[t]).length;

  // Drop-off person (who brought the car — may differ from customer for corporate)
  const [signatureName, setSignatureName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Signature capture — pad (on-screen) or WhatsApp (phone link)
  const [signatureMode, setSignatureMode] = useState<'pad' | 'whatsapp' | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isSigDrawing, setIsSigDrawing] = useState(false);
  const [hasSigDrawn, setHasSigDrawn] = useState(false);
  const [signatureSession, setSignatureSession] = useState<{ id: string; token: string; signUrl: string } | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null); // base64 from pad
  const [sendingSignature, setSendingSignature] = useState(false);
  const [signatureSent, setSignatureSent] = useState(false);

  // Estimated completion
  const [estimatedCompletion, setEstimatedCompletion] = useState('');

  // Problem & Symptoms
  const [reportedProblem, setReportedProblem] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isTaxable, setIsTaxable] = useState(true);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<SymptomCode[]>([]);
  const [symptomSearch, setSymptomSearch] = useState('');
  const { data: symptomsList } = useSymptoms(selectedFamily ?? undefined, symptomSearch || undefined);

  // Repair items
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<Set<string>>(new Set());

  // Submitting
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ── Data fetching ──
  const { data: customers } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () => api.get<{ data: Customer[] } | Customer[]>(`/customers?search=${encodeURIComponent(customerSearch)}&pageSize=20`),
    enabled: customerSearch.length > 0,
  });

  const { data: customerVehicles } = useQuery({
    queryKey: ['customer-vehicles', selectedCustomer?.id],
    queryFn: () => api.get<{ data: Vehicle[] } | Vehicle[]>(`/vehicles?customerId=${selectedCustomer!.id}&pageSize=50`),
    enabled: !!selectedCustomer,
  });

  const { data: makes } = useQuery({
    queryKey: ['vehicle-makes'],
    queryFn: () => api.get<Make[]>('/vehicle-lookup/makes'),
  });

  const { data: models } = useQuery({
    queryKey: ['vehicle-models', selectedMakeId],
    queryFn: () => api.get<Model[]>(`/vehicle-lookup/makes/${selectedMakeId}/models`),
    enabled: !!selectedMakeId,
  });

  const { data: catalogData } = useQuery({
    queryKey: ['catalog-quick'],
    queryFn: () => api.get<CatalogItem[]>('/catalog?quickAccess=true'),
  });

  const { data: allCatalogData } = useQuery({
    queryKey: ['catalog-all'],
    queryFn: () => api.get<CatalogItem[]>('/catalog'),
  });

  // Fetch photo policy setting
  useEffect(() => {
    api.get<{ key: string; value: string | null }>('/tenants/me/settings/job_card_photo_policy')
      .then((data) => {
        if (data.value === 'strict' || data.value === 'flexible') setPhotoPolicy(data.value);
      })
      .catch(() => {});
  }, []);

  // Pre-fill WhatsApp phone (for photo capture) from the customer, but leave
  // the drop-off contact phone blank — in most cases a driver drops off the
  // vehicle, not the account holder, so the advisor must enter it manually.
  useEffect(() => {
    if (selectedCustomer?.phone) {
      if (!whatsAppPhone) setWhatsAppPhone(selectedCustomer.phone);
    }
  }, [selectedCustomer, whatsAppPhone]);

  // Poll for remote photos when a capture session is active
  useEffect(() => {
    if (!captureSession || captureSession.status === 'completed') return;
    const interval = setInterval(async () => {
      try {
        const photos = await api.get<CapturePhoto[]>(`/photo-capture/sessions/${captureSession.id}/photos`);
        const list = Array.isArray(photos) ? photos : [];
        setRemotePhotos(list);
      } catch (err) {
        console.error('photo-capture poll failed', err);
      }
    }, 3000); // poll every 3 seconds
    return () => clearInterval(interval);
  }, [captureSession]);

  // Send WhatsApp or SMS capture link
  const handleSendWhatsApp = useCallback(async (captureMode: 'camera' | 'gallery') => {
    if (!whatsAppPhone.trim()) return;
    const { number: e164, error: phoneErr } = normalizePhone(whatsAppPhone);
    if (phoneErr) {
      alert(phoneErr);
      return;
    }
    setSendingWhatsApp(true);
    try {
      const body: Record<string, unknown> = {
        vehiclePlate: selectedVehicle?.plate,
        vehicleInfo: selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model}${selectedVehicle.year ? ` (${selectedVehicle.year})` : ''}` : undefined,
        captureMode,
        channel: sendChannel,
      };
      if (sendChannel === 'sms') {
        body.sendSms = e164;
      } else {
        // WhatsApp Cloud API wants digits only, no leading +
        body.sendWhatsApp = e164.replace(/^\+/, '');
      }
      const session = await api.post<CaptureSession & { messageStatus?: { sent: boolean; error?: string; channel?: string } }>('/photo-capture/sessions', body);
      setCaptureSession(session);
      if (session.messageStatus && !session.messageStatus.sent) {
        alert(`${sendChannel === 'sms' ? 'SMS' : 'WhatsApp'} not sent: ${session.messageStatus.error ?? 'unknown'}`);
      } else {
        setWhatsAppSent(true);
      }
    } catch (e) {
      alert(`Failed to create capture session: ${e instanceof Error ? e.message : String(e)}`);
    }
    setSendingWhatsApp(false);
  }, [whatsAppPhone, selectedVehicle, sendChannel]);

  // Send WhatsApp signature link
  const handleSendSignatureLink = useCallback(async () => {
    if (!contactPhone.trim()) return;
    const { number: e164, error: phoneErr } = normalizePhone(contactPhone);
    if (phoneErr) {
      alert(phoneErr);
      return;
    }
    setSendingSignature(true);
    try {
      const session = await api.post<{ id: string; token: string; signUrl: string; whatsappStatus?: { sent: boolean; error?: string } }>('/photo-capture/signature-sessions', {
        vehiclePlate: selectedVehicle?.plate,
        vehicleInfo: selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model}${selectedVehicle.year ? ` (${selectedVehicle.year})` : ''}` : undefined,
        customerName: signatureName.trim() || selectedCustomer?.full_name,
        sendWhatsApp: e164.replace(/^\+/, ''),
      });
      setSignatureSession(session);
      if (session.whatsappStatus && !session.whatsappStatus.sent) {
        alert(`WhatsApp not sent: ${session.whatsappStatus.error ?? 'unknown'}`);
      } else {
        setSignatureSent(true);
      }
    } catch (e) {
      alert(`Failed to create signature session: ${e instanceof Error ? e.message : String(e)}`);
    }
    setSendingSignature(false);
  }, [contactPhone, selectedVehicle, signatureName, selectedCustomer]);

  // Poll for signature completion
  useEffect(() => {
    if (!signatureSession || signatureUrl) return;
    const interval = setInterval(async () => {
      try {
        const photos = await api.get<Array<{ photo_type: string; storage_url: string }>>(`/photo-capture/sessions/${signatureSession.id}/photos`);
        const list = Array.isArray(photos) ? photos : [];
        const sig = list.find((p) => p.photo_type === 'signature');
        if (sig) {
          setSignatureUrl(sig.storage_url);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('signature poll failed', err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [signatureSession, signatureUrl]);

  // Unwrap paginated responses
  const customerList = Array.isArray(customers) ? customers : (customers as { data: Customer[] } | undefined)?.data ?? [];
  const vehicleList = Array.isArray(customerVehicles) ? customerVehicles : (customerVehicles as { data: Vehicle[] } | undefined)?.data ?? [];
  const makesList = Array.isArray(makes) ? makes : [];
  const modelsList = Array.isArray(models) ? models : [];
  const quickCatalog = Array.isArray(catalogData) ? catalogData : [];
  const allCatalog = Array.isArray(allCatalogData) ? allCatalogData : [];

  // ── Vehicle plate search ──
  const handlePlateSearch = async () => {
    if (!plateSearch.trim()) return;
    try {
      const data = await api.get<{ data: Vehicle[] } | Vehicle[]>(`/vehicles?search=${encodeURIComponent(plateSearch)}&pageSize=5`);
      const list = Array.isArray(data) ? data : (data as { data: Vehicle[] }).data ?? [];
      if (list.length > 0) {
        setSelectedVehicle(list[0]!);
        // Auto-fill customer
        if (list[0]!.customer_id) {
          try {
            const cust = await api.get<Customer>(`/customers/${list[0]!.customer_id}`);
            setSelectedCustomer(cust);
          } catch (err) {
            console.error('customer lookup failed', err);
          }
        }
      } else {
        setShowNewVehicle(true);
        setNewVehicle((v) => ({ ...v, plate: plateSearch.toUpperCase() }));
      }
    } catch (err) {
      console.error('plate search failed', err);
      alert(`Plate search failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  // ── Create new vehicle inline ──
  const handleCreateVehicle = async () => {
    if (!newVehicle.plate || !newVehicle.vin || !newVehicle.make) return;
    if (!selectedCustomer) { setError('Select a customer first'); return; }
    try {
      const vehicle = await api.post<Vehicle>('/vehicles', {
        customerId: selectedCustomer.id,
        plate: newVehicle.plate,
        vin: newVehicle.vin,
        make: newVehicle.make,
        model: newVehicle.model,
        year: newVehicle.year ? Number(newVehicle.year) : undefined,
        color: newVehicle.color || undefined,
        fuelType: newVehicle.fuelType || undefined,
      });
      setSelectedVehicle(vehicle);
      setShowNewVehicle(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vehicle');
    }
  };

  // ── DVI helpers ──
  const setDviStatus = (idx: number, status: string) => {
    setDviItems((prev) => prev.map((item, i) =>
      i === idx ? { ...item, status: item.status === status ? 'not_inspected' : status } : item,
    ));
  };

  // ── Toggle catalog item ──
  const toggleCatalog = (id: string) => {
    setSelectedCatalogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Validation per step ──
  const canNext = (): boolean => {
    switch (step) {
      case 'entry': return !!selectedCustomer && !!selectedVehicle;
      case 'inspection': return !!mileage.trim() && !!fuelLevel && !mileageError;
      case 'damage': return true; // damage is optional (vehicle may have none)
      case 'photos': return photoPolicy === 'flexible' ? true : photoCount >= 4;
      case 'accessories': return true; // checklist always filled with defaults
      case 'problem': return !!reportedProblem.trim() || selectedSymptoms.length > 0;
      case 'repairs': return true; // optional but encouraged
      case 'review': return true;
      default: return false;
    }
  };

  const goNext = () => {
    const idx = stepIndex;
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]!.key);
  };

  const goBack = () => {
    const idx = stepIndex;
    if (idx > 0) setStep(STEPS[idx - 1]!.key);
  };

  // ── Submit everything ──
  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedVehicle) return;
    if (!signatureName.trim()) {
      setError('Please enter the name of the person dropping off the vehicle.');
      return;
    }
    if (!contactPhone.trim()) {
      setError('Please enter a contact phone number for the drop-off person.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      // 1. Create job card
      const job = await api.post<{ id: string; job_number: string }>('/jobs', {
        customerId: selectedCustomer.id,
        vehicleId: selectedVehicle.id,
        reportedProblem: reportedProblem.trim() || selectedSymptoms.map((s) => s.label_en).join('; '),
        symptomCodes: selectedSymptoms.map((s) => s.code),
        internalNotes: internalNotes.trim() || undefined,
        estimatedCompletion: estimatedCompletion || undefined,
        isTaxable,
        isComeback: isComeback || undefined,
        comebackOriginalJobId: isComeback && comebackOriginalJobId ? comebackOriginalJobId : undefined,
        comebackReason: isComeback && comebackReason.trim() ? comebackReason.trim() : undefined,
      });

      // 2. Create vehicle reception — MANDATORY. If this fails, delete the job card.
      try {
        // Build checklist items array
        const checklistItems: Array<{ category: string; itemCode: string; itemLabel: string; status: string; detail?: string }> = [];
        const safetyLabels: Record<string, string> = { jack: 'Jack', jack_handle: 'Jack Handle / Wheel Wrench', spare_tire: 'Spare Tire', warning_triangle: 'Warning Triangle', reflective_vest: 'Reflective Vest', fire_extinguisher: 'Fire Extinguisher', first_aid_kit: 'First Aid Kit' };
        const accessoryLabels: Record<string, string> = { floor_mats: 'Floor Mats', hubcaps: 'Hubcaps / Wheel Covers', antenna: 'Antenna', wiper_blades: 'Wiper Blades', roof_rack: 'Roof Rack / Bars', tow_bar: 'Tow Bar', mud_flaps: 'Mud Flaps' };

        for (const [code, status] of Object.entries(safetyItems)) {
          if (status !== 'na') checklistItems.push({ category: 'safety', itemCode: code, itemLabel: safetyLabels[code] ?? code, status });
        }
        for (const [code, status] of Object.entries(accessoryItems)) {
          if (status !== 'na') checklistItems.push({ category: 'accessory', itemCode: code, itemLabel: accessoryLabels[code] ?? code, status });
        }
        for (const b of belongings) {
          checklistItems.push({ category: 'belonging', itemCode: '', itemLabel: b.label, status: 'present', detail: b.detail || undefined });
        }

        // Build damage points array with severity
        const damagePoints = damages.map((d) => ({
          bodyZone: d.location,
          damageType: d.type,
          severity: d.severity ?? 'moderate',
          diagramView: 'top',
          note: d.description || undefined,
        }));

        await api.post('/receptions', {
          jobCardId: job.id,
          vehicleId: selectedVehicle.id,
          odometerKm: Number(mileage),
          fuelLevel,
          keyType,
          keysReceived: Number(keysReceived) || 1,
          reportedIssues: reportedProblem.trim() || undefined,
          symptomCodes: selectedSymptoms.map((s) => s.code),
          damagePoints: damagePoints.length > 0 ? damagePoints : undefined,
          checklistItems: checklistItems.length > 0 ? checklistItems : undefined,
          signatureData: signatureUrl ?? signatureDataUrl ?? (signatureName.trim() ? `signed:${signatureName.trim()}` : undefined),
          signatureMethod: signatureUrl ? 'whatsapp' : signatureDataUrl ? 'digital' : (signatureName.trim() ? 'digital' : undefined),
          signedByName: signatureName.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
        });

        // Also create legacy inspection for backward compatibility
        const inspectedDvi = dviItems.filter((i) => i.status !== 'not_inspected');
        // Map structured checklist (present/absent/damaged/na) to legacy booleans
        // A boolean is true when the item is PRESENT. Damaged/absent/expired/na → false.
        const isPresent = (v: string | undefined) => v === 'present';
        await api.post('/inspections', {
          jobCardId: job.id,
          vehicleId: selectedVehicle.id,
          mileageIn: Number(mileage),
          fuelLevel,
          hasSpareTire: isPresent(safetyItems.spare_tire),
          hasJack: isPresent(safetyItems.jack),
          hasTools: isPresent(safetyItems.jack_handle),
          hasMats: isPresent(accessoryItems.floor_mats),
          hasHubcaps: isPresent(accessoryItems.hubcaps),
          hasAntenna: isPresent(accessoryItems.antenna),
          exteriorDamage: damages.length > 0 ? damages : [],
          dviItems: inspectedDvi.length > 0 ? inspectedDvi : undefined,
        });
      } catch (recErr) {
        // Reception failed — roll back the job card
        try {
          await api.delete(`/jobs/${job.id}`);
        } catch (delErr) {
          console.error('rollback-delete failed', delErr);
        }
        throw recErr;
      }

      // 3. Link draft sessions to job card (photos + signature)
      if (captureSession) {
        try {
          await api.patch(`/photo-capture/sessions/${captureSession.id}/link`, { jobCardId: job.id });
        } catch (linkErr) {
          // Non-fatal for job creation, but surface so the advisor can recover.
          alert(`Photos uploaded but could not be linked to the new job card: ${
            linkErr instanceof Error ? linkErr.message : String(linkErr)
          }. Open the job detail and use "Link orphan photos".`);
        }
      }
      if (signatureSession) {
        try {
          await api.patch(`/photo-capture/sessions/${signatureSession.id}/link`, { jobCardId: job.id });
        } catch (linkErr) {
          alert(`Signature captured but could not be linked: ${
            linkErr instanceof Error ? linkErr.message : String(linkErr)
          }`);
        }
      }

      // 4. Upload any locally-selected photos (from the PC "Upload" button)
      const localPhotoEntries = Object.entries(vehiclePhotos).filter(([, f]) => f) as Array<[string, File]>;
      if (localPhotoEntries.length > 0) {
        const photoErrors: string[] = [];
        for (const [photoType, file] of localPhotoEntries) {
          try {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            });
            await api.post('/photo-capture/upload', {
              jobId: job.id,
              photoType,
              base64Data: base64,
              fileName: file.name,
            });
          } catch (e) {
            photoErrors.push(`${photoType}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        if (photoErrors.length > 0) {
          alert(`Job card created, but some photos failed to upload:\n${photoErrors.join('\n')}\nYou can re-add them from the job detail page.`);
        }
      }

      // 5. Apply selected catalog items
      for (const catalogId of selectedCatalogIds) {
        try {
          await api.post(`/catalog/${catalogId}/apply-to-job/${job.id}`, {});
        } catch { /* non-critical */ }
      }

      // 6. Navigate to job detail
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job card');
      setSubmitting(false);
    }
  };

  // ── Progress bar ──
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Link href="/jobs" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Jobs</Link>
          <h1 className="text-xl font-bold text-gray-900">New Job Card</h1>
          <div className="w-20" />
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, i) => (
              <button
                key={s.key}
                onClick={() => i <= stepIndex && setStep(s.key)}
                className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                  i < stepIndex ? 'text-green-600 cursor-pointer' :
                  i === stepIndex ? 'text-primary-600' : 'text-gray-400'
                }`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  i < stepIndex ? 'bg-green-100 text-green-700' :
                  i === stepIndex ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {i < stepIndex ? '\u2713' : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {/* ── STEP: Vehicle & Customer ── */}
        {step === 'entry' && (
          <div className="space-y-6">
            {!entryMode && (
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">How would you like to start?</h2>
                <p className="text-gray-500 mb-8">Choose vehicle or customer to begin the job card</p>
                <div className="flex justify-center gap-6">
                  <button onClick={() => setEntryMode('vehicle')}
                    className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-200 bg-white p-8 hover:border-primary-500 hover:shadow-lg transition-all w-56">
                    <span className="text-4xl">&#128663;</span>
                    <span className="text-lg font-bold text-gray-900 group-hover:text-primary-600">Vehicle First</span>
                    <span className="text-xs text-gray-500">Search by plate or VIN</span>
                  </button>
                  <button onClick={() => setEntryMode('customer')}
                    className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-200 bg-white p-8 hover:border-primary-500 hover:shadow-lg transition-all w-56">
                    <span className="text-4xl">&#128100;</span>
                    <span className="text-lg font-bold text-gray-900 group-hover:text-primary-600">Customer First</span>
                    <span className="text-xs text-gray-500">Search by name or phone</span>
                  </button>
                </div>
              </div>
            )}

            {/* Vehicle first */}
            {entryMode === 'vehicle' && !selectedVehicle && (
              <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Find Vehicle</h3>
                <div className="flex gap-2">
                  <input value={plateSearch} onChange={(e) => setPlateSearch(e.target.value.toUpperCase())}
                    placeholder="Enter plate number or VIN..."
                    onKeyDown={(e) => e.key === 'Enter' && handlePlateSearch()}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-lg font-mono focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                  <button onClick={handlePlateSearch} className="rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700">Search</button>
                </div>
                <button onClick={() => { setShowNewVehicle(true); setEntryMode('customer'); }} className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium">
                  + Register New Vehicle
                </button>
              </div>
            )}

            {/* Customer first */}
            {entryMode === 'customer' && !selectedCustomer && (
              <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Find Customer</h3>
                <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
                  {customerList.map((c) => (
                    <button key={c.id} onClick={() => setSelectedCustomer(c)}
                      className="w-full text-start rounded-lg border border-gray-100 px-4 py-3 hover:border-primary-300 hover:bg-primary-50 transition-colors">
                      <span className="font-semibold text-gray-900">{c.full_name}</span>
                      <span className="ms-3 text-sm text-gray-500">{c.phone}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected customer → pick vehicle */}
            {selectedCustomer && !selectedVehicle && (
              <div className="space-y-4">
                <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-green-600 font-semibold uppercase">Customer</span>
                    <p className="font-bold text-green-900">{selectedCustomer.full_name}</p>
                    <p className="text-sm text-green-700">{selectedCustomer.phone}</p>
                  </div>
                  <button onClick={() => { setSelectedCustomer(null); setEntryMode('customer'); }} className="text-xs text-green-600 hover:text-green-800">Change</button>
                </div>

                <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Select Vehicle</h3>
                  <input
                    placeholder="Search by plate, make or model..."
                    onChange={(e) => {
                      const q = e.target.value.toLowerCase();
                      // Filter is done inline below
                      (e.target as HTMLInputElement).dataset.filter = q;
                      // Force re-render by setting a dummy state
                      setPlateSearch(q);
                    }}
                    className="mb-3 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  />
                  {vehicleList.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {vehicleList
                        .filter((v) => {
                          if (!plateSearch) return true;
                          const q = plateSearch.toLowerCase();
                          return v.plate.toLowerCase().includes(q) ||
                            v.make.toLowerCase().includes(q) ||
                            v.model.toLowerCase().includes(q) ||
                            (v.vin ?? '').toLowerCase().includes(q);
                        })
                        .map((v) => (
                        <button key={v.id} onClick={() => setSelectedVehicle(v)}
                          className="w-full text-start rounded-lg border-2 border-gray-200 px-4 py-3 hover:border-primary-500 hover:bg-primary-50 transition-all">
                          <span className="text-lg font-mono font-bold text-gray-900">{v.plate}</span>
                          <span className="ms-3 text-sm text-gray-600">{v.make} {v.model} {v.year ? `(${v.year})` : ''}</span>
                          {v.vin && <span className="ms-2 text-xs text-gray-400 font-mono">{v.vin}</span>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mb-3">No vehicles found for this customer.</p>
                  )}
                  <button onClick={() => setShowNewVehicle(true)} className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium">
                    + Register New Vehicle
                  </button>
                </div>
              </div>
            )}

            {/* New vehicle inline form */}
            {showNewVehicle && (
              <div className="rounded-xl bg-white p-6 shadow-sm border-2 border-primary-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Register New Vehicle</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Plate *</label>
                    <input value={newVehicle.plate} onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">VIN *</label>
                    <input value={newVehicle.vin} onChange={(e) => setNewVehicle({ ...newVehicle, vin: e.target.value.toUpperCase() })}
                      maxLength={17}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Brand *</label>
                    <select value={selectedMakeId} onChange={(e) => {
                      const id = e.target.value;
                      setSelectedMakeId(id);
                      const make = makesList.find((m) => m.id === id);
                      setNewVehicle({ ...newVehicle, makeId: id, make: make?.name ?? '' });
                    }} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 bg-white">
                      <option value="">— Select Brand —</option>
                      {makesList.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Model *</label>
                    <select value={newVehicle.model} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 bg-white">
                      <option value="">— Select Model —</option>
                      {modelsList.map((m) => <option key={m.id} value={m.name}>{m.name} {m.body_type ? `(${m.body_type})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Year</label>
                    <input type="number" value={newVehicle.year} onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })}
                      min="1990" max="2030" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Color</label>
                    <input value={newVehicle.color} onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={handleCreateVehicle} disabled={!newVehicle.plate || !newVehicle.vin || !newVehicle.make}
                    className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40">
                    Create Vehicle
                  </button>
                  <button onClick={() => setShowNewVehicle(false)} className="rounded-lg border px-4 py-2 text-sm text-gray-600">Cancel</button>
                </div>
              </div>
            )}

            {/* Both selected */}
            {selectedCustomer && selectedVehicle && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                    <span className="text-xs text-green-600 font-semibold uppercase">Customer</span>
                    <p className="font-bold text-green-900">{selectedCustomer.full_name}</p>
                    <p className="text-sm text-green-700">{selectedCustomer.phone}</p>
                    <button onClick={() => { setSelectedCustomer(null); setSelectedVehicle(null); setEntryMode(null); }} className="mt-2 text-xs text-green-600 hover:text-green-800">Change</button>
                  </div>
                  <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                    <span className="text-xs text-blue-600 font-semibold uppercase">Vehicle</span>
                    <p className="font-bold font-mono text-blue-900">{selectedVehicle.plate}</p>
                    <p className="text-sm text-blue-700">{selectedVehicle.make} {selectedVehicle.model}</p>
                    <button onClick={() => { setSelectedVehicle(null); }} className="mt-2 text-xs text-blue-600 hover:text-blue-800">Change</button>
                  </div>
                </div>

                {(hasActiveWarranty || hasRecentJobs) && (
                  <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-amber-600">&#9888;</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-amber-900">Possible comeback</h4>
                        <p className="mt-1 text-sm text-amber-800">
                          {hasActiveWarranty
                            ? `This vehicle has ${warrantyCoverage?.active_coverage.length} item${
                                warrantyCoverage?.active_coverage.length === 1 ? '' : 's'
                              } still under warranty. `
                            : ''}
                          {hasRecentJobs ? `${recentJobs.length} job${recentJobs.length === 1 ? '' : 's'} in the last 30 days. ` : ''}
                          If this new job is related to previous work, flag it as a comeback so first-time-right metrics stay honest.
                        </p>

                        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-amber-900">
                          <input
                            type="checkbox"
                            checked={isComeback}
                            onChange={(e) => {
                              setIsComeback(e.target.checked);
                              if (!e.target.checked) {
                                setComebackOriginalJobId('');
                                setComebackReason('');
                              }
                            }}
                            className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                          />
                          Flag as a comeback
                        </label>

                        {isComeback && (
                          <div className="mt-3 space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-amber-900">Original job</label>
                              <select
                                value={comebackOriginalJobId}
                                onChange={(e) => setComebackOriginalJobId(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm"
                              >
                                <option value="">Select the job this relates to…</option>
                                {recentJobs.map((j) => (
                                  <option key={j.id} value={j.id}>
                                    {j.job_number} — {j.status} ({new Date(j.created_at).toLocaleDateString()})
                                  </option>
                                ))}
                                {warrantyCoverage?.active_coverage.map((c) => (
                                  <option key={`wc-${c.id}`} value={c.job_card_id}>
                                    {c.job_number ?? '—'} — warranty on {c.description}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-amber-900">Reason (optional)</label>
                              <input
                                value={comebackReason}
                                onChange={(e) => setComebackReason(e.target.value)}
                                placeholder="e.g. same noise returned after brake job"
                                className="mt-1 block w-full rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── STEP: Inspection ── */}
        {step === 'inspection' && (
          <div className="space-y-6">
            {/* Mileage & Fuel */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Vehicle Condition</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Odometer (km) *</label>
                  <input type="number" value={mileage} onChange={(e) => handleMileageChange(e.target.value)}
                    className={`mt-1 block w-full rounded-lg border px-3 py-2 text-lg ${mileageError ? 'border-red-500 bg-red-50' : 'border-gray-300'}`} />
                  {mileageError && (
                    <p className="mt-1 text-sm text-red-600 font-medium">{mileageError}</p>
                  )}
                  {!mileageError && selectedVehicle?.mileage != null && (
                    <p className="mt-1 text-xs text-gray-400">Last recorded: {selectedVehicle.mileage.toLocaleString()} km</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fuel Level *</label>
                  <div className="flex gap-2">
                    {FUEL_LEVELS.map((level) => (
                      <button key={level} onClick={() => setFuelLevel(level)}
                        className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                          fuelLevel === level ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        {level.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Keys */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Key Type</label>
                  <div className="flex gap-2">
                    {(['standard', 'remote', 'keyless', 'valet'] as const).map((kt) => (
                      <button key={kt} onClick={() => setKeyType(kt)}
                        className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                          keyType === kt ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        {kt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Keys Received</label>
                  <input type="number" min="1" max="10" value={keysReceived} onChange={(e) => setKeysReceived(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
                </div>
              </div>
            </div>

            {/* Damage diagram and accessories moved to their own steps (3 & 4) */}

            {/* DVI Traffic Light */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-2">DVI Inspection</h3>
              <div className="flex gap-4 mb-4 text-xs">
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-green-500 inline-block" /> Good</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-yellow-500 inline-block" /> Monitor</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-500 inline-block" /> Urgent</span>
              </div>
              {[...new Set(dviItems.map((i) => i.category))].map((cat) => (
                <div key={cat} className="mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{cat}</p>
                  {dviItems.map((item, idx) => {
                    if (item.category !== cat) return null;
                    const bg = item.status === 'green' ? 'bg-green-50 border-green-200' : item.status === 'yellow' ? 'bg-yellow-50 border-yellow-200' : item.status === 'red' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200';
                    return (
                      <div key={idx} className={`flex items-center gap-3 rounded-lg border px-3 py-2 mb-1 ${bg}`}>
                        <span className="text-sm font-medium text-gray-700 flex-1">{item.name}</span>
                        {(['green', 'yellow', 'red'] as const).map((s) => (
                          <button key={s} onClick={() => setDviStatus(idx, s)}
                            className={`h-6 w-6 rounded-full transition-all ${
                              item.status === s ? `${s === 'green' ? 'bg-green-500' : s === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'} ring-2 ring-offset-1 ring-${s === 'green' ? 'green' : s === 'yellow' ? 'yellow' : 'red'}-300` :
                              `${s === 'green' ? 'bg-green-200' : s === 'yellow' ? 'bg-yellow-200' : 'bg-red-200'} opacity-40 hover:opacity-80`
                            }`} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="mt-3 flex gap-3 text-xs font-semibold">
                <span className="text-green-600">{dviItems.filter((i) => i.status === 'green').length} Good</span>
                <span className="text-yellow-600">{dviItems.filter((i) => i.status === 'yellow').length} Monitor</span>
                <span className="text-red-600">{dviItems.filter((i) => i.status === 'red').length} Urgent</span>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Damage Map ── */}
        {step === 'damage' && (
          <div className="space-y-6">
            {/* This reuses the existing damage diagram already in the inspection step */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Exterior Damage Map</h3>
              <p className="text-sm text-gray-500 mb-4">Walk around the vehicle. Click any zone on the diagram to record pre-existing damage. This protects the workshop from liability.</p>
              <div className="flex gap-6 items-start">
                {/* SVG Car Diagram — same as inspection step */}
                <div className="flex-shrink-0 bg-gray-50 rounded-lg border border-gray-200 p-4">
                  <svg viewBox="0 0 400 520" width="280" height="380">
                    <text x={200} y={8} textAnchor="middle" fontSize={10} fill="#9CA3AF" fontWeight="600">FRONT</text>
                    <text x={200} y={518} textAnchor="middle" fontSize={10} fill="#9CA3AF" fontWeight="600">REAR</text>
                    {[
                      { id: 'front_bumper', label: 'Front Bumper', path: 'M120,10 L280,10 Q290,10 290,20 L290,45 L110,45 L110,20 Q110,10 120,10 Z', cx: 200, cy: 28 },
                      { id: 'hood', label: 'Hood', path: 'M115,50 L285,50 L280,130 Q275,140 270,140 L130,140 Q125,140 120,130 Z', cx: 200, cy: 95 },
                      { id: 'windshield', label: 'Windshield', path: 'M135,145 L265,145 L255,195 Q250,200 245,200 L155,200 Q150,200 145,195 Z', cx: 200, cy: 172 },
                      { id: 'roof', label: 'Roof', path: 'M148,205 L252,205 L252,310 L148,310 Z', cx: 200, cy: 258 },
                      { id: 'rear_window', label: 'Rear Window', path: 'M145,315 L255,315 L265,365 Q268,370 265,375 L135,375 Q132,370 135,365 Z', cx: 200, cy: 345 },
                      { id: 'trunk', label: 'Trunk', path: 'M120,380 L280,380 Q285,380 285,390 L280,460 L120,460 L115,390 Q115,380 120,380 Z', cx: 200, cy: 420 },
                      { id: 'rear_bumper', label: 'Rear Bumper', path: 'M115,465 L285,465 L290,495 Q290,505 280,505 L120,505 Q110,505 110,495 Z', cx: 200, cy: 485 },
                      { id: 'left_door_front', label: 'L Front Door', path: 'M290,95 L340,105 Q350,108 355,115 L355,205 L340,205 L290,200 Z', cx: 325, cy: 150 },
                      { id: 'left_door_rear', label: 'L Rear Door', path: 'M290,210 L340,210 L355,210 L355,315 Q350,320 340,322 L290,315 Z', cx: 325, cy: 265 },
                      { id: 'right_door_front', label: 'R Front Door', path: 'M110,95 L60,105 Q50,108 45,115 L45,205 L60,205 L110,200 Z', cx: 75, cy: 150 },
                      { id: 'right_door_rear', label: 'R Rear Door', path: 'M110,210 L60,210 L45,210 L45,315 Q50,320 60,322 L110,315 Z', cx: 75, cy: 265 },
                      { id: 'front_left_wheel', label: 'FL Wheel', path: 'M355,80 A25,25 0 1,1 355,130 A25,25 0 1,1 355,80 Z', cx: 355, cy: 105 },
                      { id: 'front_right_wheel', label: 'FR Wheel', path: 'M45,80 A25,25 0 1,1 45,130 A25,25 0 1,1 45,80 Z', cx: 45, cy: 105 },
                      { id: 'rear_left_wheel', label: 'RL Wheel', path: 'M355,370 A25,25 0 1,1 355,420 A25,25 0 1,1 355,370 Z', cx: 355, cy: 395 },
                      { id: 'rear_right_wheel', label: 'RR Wheel', path: 'M45,370 A25,25 0 1,1 45,420 A25,25 0 1,1 45,370 Z', cx: 45, cy: 395 },
                      { id: 'left_mirror', label: 'L Mirror', path: 'M350,70 L375,60 L380,75 L355,85 Z', cx: 365, cy: 72 },
                      { id: 'right_mirror', label: 'R Mirror', path: 'M50,70 L25,60 L20,75 L45,85 Z', cx: 35, cy: 72 },
                    ].map((zone) => {
                      const zoneDamages = damages.filter((d) => d.location === zone.id);
                      const hasDamage = zoneDamages.length > 0;
                      const isSmall = zone.id.includes('mirror') || zone.id.includes('wheel');
                      return (
                        <g key={zone.id} onClick={() => { setDamageZone(zone.id); setDamageType('scratch'); setDamageDesc(''); }} className="cursor-pointer">
                          <path d={zone.path} fill={hasDamage ? '#FEE2E2' : isSmall ? '#E5E7EB' : '#F3F4F6'} stroke={hasDamage ? '#EF4444' : '#9CA3AF'} strokeWidth={hasDamage ? 2.5 : 1.2} />
                          <text x={zone.cx} y={zone.cy + (isSmall ? 0 : 4)} textAnchor="middle" fontSize={isSmall ? 6 : 8} fill={hasDamage ? '#DC2626' : '#6B7280'} fontWeight={hasDamage ? 'bold' : 'normal'} className="pointer-events-none select-none">{zone.label}</text>
                          {hasDamage && (<><circle cx={zone.cx} cy={zone.cy - 16} r={11} fill="#EF4444" stroke="#fff" strokeWidth={2} /><text x={zone.cx} y={zone.cy - 12} textAnchor="middle" fontSize={11} fill="white" fontWeight="bold" className="pointer-events-none">{zoneDamages.length}</text></>)}
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  {damageZone && (
                    <div className="rounded-lg border-2 border-primary-300 bg-primary-50 p-4 mb-4">
                      <p className="font-semibold text-gray-900 mb-2">{damageZone.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(['scratch', 'dent', 'crack', 'chip', 'broken', 'missing', 'rust', 'paint_damage', 'glass_crack', 'torn'] as const).map((dt) => {
                          const colors: Record<string, string> = { scratch: '#FF9800', dent: '#F44336', crack: '#9C27B0', chip: '#795548', broken: '#D32F2F', missing: '#607D8B', rust: '#8D6E63', paint_damage: '#2196F3', glass_crack: '#00BCD4', torn: '#9E9E9E' };
                          return (
                            <button key={dt} onClick={() => setDamageType(dt)} className="rounded-full px-3 py-1 text-xs font-semibold border transition-colors"
                              style={damageType === dt ? { backgroundColor: colors[dt], color: '#fff', borderColor: colors[dt] } : { borderColor: '#D1D5DB', color: '#374151' }}>
                              {dt.replace('_', ' ')}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 mb-2">
                        {(['minor', 'moderate', 'severe'] as const).map((sev) => (
                          <button key={sev} onClick={() => { /* severity stored in damage entry */ }}
                            className="rounded-full px-3 py-1 text-xs font-semibold border border-gray-300 text-gray-600 hover:bg-gray-100">
                            {sev}
                          </button>
                        ))}
                      </div>
                      <input value={damageDesc} onChange={(e) => setDamageDesc(e.target.value)} placeholder="Description (optional)" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3" />
                      <div className="flex gap-2">
                        <button onClick={() => { setDamages([...damages, { location: damageZone, type: damageType, description: damageDesc.trim() || undefined }]); setDamageZone(null); }} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">Add Damage</button>
                        <button onClick={() => setDamageZone(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600">Cancel</button>
                      </div>
                    </div>
                  )}
                  {damages.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700">{damages.length} damage{damages.length > 1 ? 's' : ''} recorded</p>
                      {damages.map((d, i) => {
                        const colors: Record<string, string> = { scratch: '#FF9800', dent: '#F44336', crack: '#9C27B0', chip: '#795548', broken: '#D32F2F', missing: '#607D8B', rust: '#8D6E63', paint_damage: '#2196F3', glass_crack: '#00BCD4', torn: '#9E9E9E' };
                        return (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                            <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: colors[d.type] ?? '#F44336' }} />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-semibold text-gray-900">{d.location.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                              <span className="text-sm text-gray-500 ms-2">{d.type.replace('_', ' ')}{d.description ? ` — ${d.description}` : ''}</span>
                            </div>
                            <button onClick={() => setDamages(damages.filter((_, j) => j !== i))} className="text-red-600 text-xs font-semibold hover:text-red-800">Remove</button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed border-green-300 bg-green-50 p-6 text-center">
                      <p className="text-green-700 font-semibold">No damage found</p>
                      <p className="text-sm text-green-600 mt-1">If the vehicle has no pre-existing damage, proceed to the next step</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Walk-Around Photos ── */}
        {step === 'photos' && (
          <div className="space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Vehicle Walk-Around Photos</h3>
              <p className="text-sm text-gray-500 mb-4">
                Upload at least 4 photos of the vehicle exterior. These document the vehicle condition at check-in and protect the workshop from liability claims.
              </p>

              {/* Photo grid — shows both local uploads and remote captures */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {REQUIRED_PHOTOS.map(({ key, label, desc }) => {
                  const hasLocal = !!vehiclePhotos[key];
                  const hasRemote = remotePhotoTypes.has(key);
                  const hasPhoto = hasLocal || hasRemote;
                  return (
                    <div key={key} className={`rounded-lg border-2 p-4 text-center transition-all ${
                      hasPhoto ? 'border-green-400 bg-green-50' : 'border-dashed border-gray-300 hover:border-primary-400'
                    }`}>
                      <div className="text-3xl mb-2">{hasPhoto ? '\u2705' : '\ud83d\udcf7'}</div>
                      <p className="text-sm font-semibold text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500 mt-1">{desc}</p>
                      {hasRemote && !hasLocal ? (
                        <span className="mt-3 inline-block rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                          Via Phone
                        </span>
                      ) : (
                        <label className="mt-3 inline-block cursor-pointer rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
                          {hasPhoto ? 'Replace' : 'Upload'}
                          <input type="file" accept="image/*" capture="environment" className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              setVehiclePhotos({ ...vehiclePhotos, [key]: file });
                            }} />
                        </label>
                      )}
                      {hasLocal && vehiclePhotos[key] && (
                        <p className="text-xs text-green-600 mt-1 truncate">{vehiclePhotos[key]!.name}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Photo count status */}
              <div className="mt-4 flex items-center justify-between">
                <div className={`text-sm font-semibold ${photoCount >= 4 ? 'text-green-600' : 'text-amber-600'}`}>
                  {photoCount} / 6 photos uploaded
                  {photoCount < 4 && ' \u2014 minimum 4 required'}
                </div>
                {captureSession && remotePhotos.length > 0 && (
                  <span className="text-xs text-green-600 font-medium animate-pulse">
                    {remotePhotos.length} received from phone
                  </span>
                )}
              </div>
            </div>

            {/* ── Use your phone ── */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-base font-bold text-gray-900 mb-1">Use your phone</h3>
              <p className="text-sm text-gray-500 mb-4">
                Send a link to your WhatsApp to take new photos or upload existing ones from your phone gallery.
              </p>

              {!whatsAppSent ? (
                <>
                  {/* Channel toggle */}
                  <div className="flex gap-1 rounded-lg bg-gray-100 p-1 mb-3">
                    <button
                      type="button"
                      onClick={() => setSendChannel('whatsapp')}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        sendChannel === 'whatsapp' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setSendChannel('sms')}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        sendChannel === 'sms' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      SMS
                    </button>
                  </div>

                  {/* Phone number input */}
                  <div className="flex gap-2 mb-4">
                    <input
                      value={whatsAppPhone}
                      onChange={(e) => setWhatsAppPhone(e.target.value)}
                      placeholder={sendChannel === 'sms' ? 'SMS number (e.g. +244 923 456 789)' : 'WhatsApp number (e.g. +244 923 456 789)'}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                    />
                  </div>

                  {/* Two action buttons: Camera and Gallery */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleSendWhatsApp('camera')}
                      disabled={sendingWhatsApp || !whatsAppPhone.trim()}
                      className="flex flex-col items-center gap-2 rounded-xl border-2 border-primary-200 bg-primary-50 p-4 hover:border-primary-400 hover:shadow-md transition-all disabled:opacity-40"
                    >
                      <span className="text-2xl">📸</span>
                      <span className="text-sm font-bold text-primary-900">Take Photos</span>
                      <span className="text-xs text-primary-600">Opens camera on phone</span>
                    </button>
                    <button
                      onClick={() => handleSendWhatsApp('gallery')}
                      disabled={sendingWhatsApp || !whatsAppPhone.trim()}
                      className="flex flex-col items-center gap-2 rounded-xl border-2 border-gray-200 bg-gray-50 p-4 hover:border-gray-400 hover:shadow-md transition-all disabled:opacity-40"
                    >
                      <span className="text-2xl">🖼</span>
                      <span className="text-sm font-bold text-gray-900">Upload Existing</span>
                      <span className="text-xs text-gray-500">Pick from phone gallery</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Waiting for photos */
                <div className="rounded-lg border-2 border-dashed border-green-300 bg-green-50 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <span className="text-xl">📱</span>
                    </div>
                    <div>
                      <p className="font-semibold text-green-900">Link sent to {whatsAppPhone}</p>
                      <p className="text-xs text-green-700">
                        {captureSession?.capture_mode === 'gallery' ? 'Upload from gallery' : 'Take photos'} on your phone \u2014 they appear here automatically
                      </p>
                    </div>
                  </div>

                  {/* Live photo counter */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-green-200 rounded-full h-2.5">
                      <div
                        className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${(remotePhotos.length / 6) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-green-800">{remotePhotos.length}/6</span>
                  </div>

                  {remotePhotos.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {remotePhotos.map((p) => (
                        <span key={p.photo_type} className="inline-flex items-center gap-1 rounded-full bg-green-200 px-2.5 py-1 text-xs font-semibold text-green-800">
                          ✓ {REQUIRED_PHOTOS.find((r) => r.key === p.photo_type)?.label ?? p.photo_type}
                        </span>
                      ))}
                    </div>
                  )}

                  {remotePhotos.length === 0 && (
                    <p className="mt-3 text-sm text-green-600 animate-pulse">
                      Waiting for photos...
                    </p>
                  )}

                  {/* Option to send a new link */}
                  <button
                    onClick={() => { setWhatsAppSent(false); setCaptureSession(null); setRemotePhotos([]); }}
                    className="mt-3 text-xs text-green-700 hover:text-green-900 underline"
                  >
                    Send a new link instead
                  </button>
                </div>
              )}
            </div>

            {/* Flexible mode warning */}
            {photoPolicy === 'flexible' && photoCount < 4 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">You can proceed without photos</p>
                <p className="text-xs text-amber-600 mt-1">
                  Photos can be added after the job card is created. However, the job card cannot be closed until at least 4 photos are uploaded.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Accessories & Belongings ── */}
        {step === 'accessories' && (
          <div className="space-y-6">
            {/* Safety Items */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Safety Equipment</h3>
              <div className="space-y-2">
                {([
                  { code: 'jack', label: 'Jack' },
                  { code: 'jack_handle', label: 'Jack Handle / Wheel Wrench' },
                  { code: 'spare_tire', label: 'Spare Tire' },
                  { code: 'warning_triangle', label: 'Warning Triangle' },
                  { code: 'reflective_vest', label: 'Reflective Vest' },
                  { code: 'fire_extinguisher', label: 'Fire Extinguisher' },
                  { code: 'first_aid_kit', label: 'First Aid Kit' },
                ] as const).map(({ code, label }) => (
                  <div key={code} className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-2.5">
                    <span className="text-sm font-medium text-gray-700 flex-1">{label}</span>
                    {(['present', 'absent', 'damaged', 'expired'] as const).map((st) => (
                      <button key={st} onClick={() => setSafetyItems({ ...safetyItems, [code]: safetyItems[code] === st ? 'na' : st })}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          safetyItems[code] === st
                            ? st === 'present' ? 'bg-green-100 border-green-500 text-green-800'
                              : st === 'absent' ? 'bg-red-100 border-red-500 text-red-800'
                              : st === 'damaged' ? 'bg-orange-100 border-orange-500 text-orange-800'
                              : 'bg-yellow-100 border-yellow-500 text-yellow-800'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        {st}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Vehicle Accessories */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Vehicle Accessories</h3>
              <div className="space-y-2">
                {([
                  { code: 'floor_mats', label: 'Floor Mats' },
                  { code: 'hubcaps', label: 'Hubcaps / Wheel Covers' },
                  { code: 'antenna', label: 'Antenna' },
                  { code: 'wiper_blades', label: 'Wiper Blades' },
                  { code: 'roof_rack', label: 'Roof Rack / Bars' },
                  { code: 'tow_bar', label: 'Tow Bar' },
                  { code: 'mud_flaps', label: 'Mud Flaps' },
                ] as const).map(({ code, label }) => (
                  <div key={code} className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-2.5">
                    <span className="text-sm font-medium text-gray-700 flex-1">{label}</span>
                    {(['present', 'absent', 'damaged'] as const).map((st) => (
                      <button key={st} onClick={() => setAccessoryItems({ ...accessoryItems, [code]: accessoryItems[code] === st ? 'na' : st })}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          accessoryItems[code] === st
                            ? st === 'present' ? 'bg-green-100 border-green-500 text-green-800'
                              : st === 'absent' ? 'bg-red-100 border-red-500 text-red-800'
                              : 'bg-orange-100 border-orange-500 text-orange-800'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        {st}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Personal Belongings */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Personal Belongings Left in Vehicle</h3>
              <div className="flex gap-2 mb-3">
                <input value={newBelonging} onChange={(e) => setNewBelonging(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newBelonging.trim()) { setBelongings([...belongings, { label: newBelonging.trim(), detail: '' }]); setNewBelonging(''); } }}
                  placeholder="e.g. Laptop bag on rear seat, Sunglasses in glove box..."
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <button onClick={() => { if (newBelonging.trim()) { setBelongings([...belongings, { label: newBelonging.trim(), detail: '' }]); setNewBelonging(''); } }}
                  disabled={!newBelonging.trim()}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40">
                  Add
                </button>
              </div>
              {belongings.length > 0 ? (
                <div className="space-y-1">
                  {belongings.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                      <span className="text-sm text-gray-900 flex-1">{b.label}</span>
                      <button onClick={() => setBelongings(belongings.filter((_, j) => j !== i))} className="text-red-600 text-xs font-semibold">Remove</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No belongings logged</p>
              )}
            </div>
          </div>
        )}

        {/* ── STEP: Problem Description ── */}
        {step === 'problem' && (() => {
          const families = [
            { key: 'quick_service', label: 'Quick Service', icon: '⚡', desc: 'Oil change, filters, tires, battery...' },
            { key: 'mechanic', label: 'Mechanic', icon: '🔧', desc: 'Engine, brakes, transmission, electrical...' },
            { key: 'body_paint', label: 'Body & Paint', icon: '🎨', desc: 'Scratches, dents, collision, respray...' },
          ];
          const allSymptoms = Array.isArray(symptomsList) ? symptomsList : [];
          const topSymptoms = allSymptoms.slice(0, 10);
          const otherSymptoms = allSymptoms.slice(10).filter((s) =>
            !symptomSearch || s.label_en.toLowerCase().includes(symptomSearch.toLowerCase()) || s.label_pt.toLowerCase().includes(symptomSearch.toLowerCase())
          );
          const isSelected = (code: string) => selectedSymptoms.some((s) => s.code === code);
          const toggleSymptom = (symptom: SymptomCode) => {
            if (isSelected(symptom.code)) {
              setSelectedSymptoms(selectedSymptoms.filter((s) => s.code !== symptom.code));
            } else {
              setSelectedSymptoms([...selectedSymptoms, symptom]);
            }
          };

          return (
          <div className="space-y-6">
            {/* Family selector */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">What type of service?</h3>
              <div className="grid grid-cols-3 gap-3">
                {families.map((f) => (
                  <button key={f.key} onClick={() => { setSelectedFamily(f.key); setSymptomSearch(''); }}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all ${
                      selectedFamily === f.key
                        ? 'border-primary-500 bg-primary-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}>
                    <span className="text-3xl">{f.icon}</span>
                    <span className="text-sm font-bold text-gray-900">{f.label}</span>
                    <span className="text-xs text-gray-500 text-center">{f.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Symptoms for selected family */}
            {selectedFamily && (
              <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Symptoms</h3>
                <p className="text-sm text-gray-500 mb-4">Select all that apply — most common shown first</p>

                {/* Top 10 as chips */}
                {topSymptoms.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {topSymptoms.map((s) => (
                      <button key={s.code} onClick={() => toggleSymptom(s)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                          isSelected(s.code)
                            ? 'border-green-500 bg-green-50 text-green-800 shadow-sm'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}>
                        {s.icon && <span>{s.icon}</span>}
                        <span>{s.label_en}</span>
                        {isSelected(s.code) && <span className="ms-1 text-green-600">&#10003;</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Search + dropdown for rest */}
                {otherSymptoms.length > 0 && (
                  <div className="mb-4">
                    <input value={symptomSearch} onChange={(e) => setSymptomSearch(e.target.value)}
                      placeholder="Search more symptoms..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                    {symptomSearch && (
                      <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                        {otherSymptoms.filter((s) => !isSelected(s.code)).map((s) => (
                          <button key={s.code} onClick={() => { toggleSymptom(s); setSymptomSearch(''); }}
                            className="w-full text-start px-3 py-2 text-sm hover:bg-primary-50 flex items-center gap-2">
                            {s.icon && <span>{s.icon}</span>}
                            <span>{s.label_en}</span>
                            <span className="text-xs text-gray-400 ms-auto">{s.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Selected symptoms */}
                {selectedSymptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4 pt-3 border-t border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 uppercase w-full mb-1">Selected ({selectedSymptoms.length})</span>
                    {selectedSymptoms.map((s) => (
                      <span key={s.code} className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-semibold">
                        {s.icon} {s.label_en}
                        <button onClick={() => toggleSymptom(s)} className="ms-1 text-green-600 hover:text-red-600">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Free text complaint + notes */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Additional Details</label>
                <textarea value={reportedProblem} onChange={(e) => setReportedProblem(e.target.value)}
                  rows={3} placeholder="Describe any additional issues or details..."
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Internal Notes</label>
                <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2} placeholder="Workshop-only notes (not visible to customer)"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3" />
              </div>
              <label className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  checked={isTaxable}
                  onChange={(e) => setIsTaxable(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">
                  Apply VAT to this job (uncheck for VAT-exempt / export work)
                </span>
              </label>
            </div>
          </div>
          );
        })()}

        {/* ── STEP: Repair Items ── */}
        {step === 'repairs' && (() => {
          const BODY_CATEGORIES = ['Body Repair'];
          const isMech = (cat: string | null) => !cat || !BODY_CATEGORIES.includes(cat);
          const isBody = (cat: string | null) => cat ? BODY_CATEGORIES.includes(cat) : false;

          return (
          <div className="space-y-6">
            {/* Mechanical / Body toggle */}
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
              <button onClick={() => setPlateSearch('mechanical')}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                  plateSearch !== 'body' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                Mechanical
              </button>
              <button onClick={() => setPlateSearch('body')}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                  plateSearch === 'body' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                Body Shop
              </button>
            </div>

            {/* Quick Access */}
            {quickCatalog.filter((i) => plateSearch === 'body' ? isBody(i.category) : isMech(i.category)).length > 0 && (
              <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Quick Access</h3>
                <div className="grid grid-cols-2 gap-2">
                  {quickCatalog.filter((i) => plateSearch === 'body' ? isBody(i.category) : isMech(i.category)).map((item) => (
                    <label key={item.id} className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 cursor-pointer transition-colors ${
                      selectedCatalogIds.has(item.id) ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input type="checkbox" checked={selectedCatalogIds.has(item.id)} onChange={() => toggleCatalog(item.id)}
                        className="rounded border-gray-300 text-primary-600" />
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-900">{item.name}</span>
                        {item.estimated_hours && <span className="ms-2 text-xs text-gray-400">{item.estimated_hours}h</span>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* All Services (filtered) */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-3">
                {plateSearch === 'body' ? 'Body Shop Services' : 'Mechanical Services'}
              </h3>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {allCatalog
                  .filter((i) => !i.quick_access)
                  .filter((i) => plateSearch === 'body' ? isBody(i.category) : isMech(i.category))
                  .map((item) => (
                  <label key={item.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer ${
                    selectedCatalogIds.has(item.id) ? 'border-primary-400 bg-primary-50' : 'border-gray-100 hover:border-gray-200'
                  }`}>
                    <input type="checkbox" checked={selectedCatalogIds.has(item.id)} onChange={() => toggleCatalog(item.id)}
                      className="rounded border-gray-300 text-primary-600" />
                    <span className="text-sm text-gray-900 flex-1">{item.name}</span>
                    {item.estimated_hours && <span className="text-xs text-gray-400">{item.estimated_hours}h</span>}
                    {item.category && <span className="text-xs text-gray-300 ms-1">{item.category}</span>}
                  </label>
                ))}
                {allCatalog
                  .filter((i) => !i.quick_access)
                  .filter((i) => plateSearch === 'body' ? isBody(i.category) : isMech(i.category))
                  .length === 0 && (
                  <p className="text-sm text-gray-500 py-4 text-center">No items in this category</p>
                )}
              </div>
            </div>

            {selectedCatalogIds.size > 0 && (
              <div className="text-center text-sm text-primary-600 font-semibold">
                {selectedCatalogIds.size} service{selectedCatalogIds.size > 1 ? 's' : ''} selected
              </div>
            )}
          </div>
          );
        })()}

        {/* ── STEP: Review ── */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Review Job Card</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Customer</p>
                  <p className="font-semibold text-gray-900">{selectedCustomer?.full_name}</p>
                  <p className="text-sm text-gray-500">{selectedCustomer?.phone}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Vehicle</p>
                  <p className="font-mono font-bold text-gray-900">{selectedVehicle?.plate}</p>
                  <p className="text-sm text-gray-500">{selectedVehicle?.make} {selectedVehicle?.model}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Odometer</p>
                  <p className="font-semibold text-gray-900">{mileage} km</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Fuel</p>
                  <p className="font-semibold text-gray-900">{fuelLevel.replace('_', ' ')}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-gray-400 uppercase block">Expected Completion</label>
                  <input
                    type="date"
                    value={estimatedCompletion}
                    onChange={(e) => setEstimatedCompletion(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-bold text-gray-400 uppercase">DVI Summary</p>
                  <div className="flex gap-4 mt-1">
                    <span className="text-sm text-green-600 font-medium">{dviItems.filter((i) => i.status === 'green').length} Good</span>
                    <span className="text-sm text-yellow-600 font-medium">{dviItems.filter((i) => i.status === 'yellow').length} Monitor</span>
                    <span className="text-sm text-red-600 font-medium">{dviItems.filter((i) => i.status === 'red').length} Urgent</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-bold text-gray-400 uppercase">Reported Problem</p>
                  <p className="text-gray-900 mt-1">{reportedProblem}</p>
                </div>
                {selectedCatalogIds.size > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-gray-400 uppercase">Repair Items ({selectedCatalogIds.size})</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[...selectedCatalogIds].map((id) => {
                        const item = allCatalog.find((c) => c.id === id) ?? quickCatalog.find((c) => c.id === id);
                        return item ? <span key={id} className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700">{item.name}</span> : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drop-off Person & Signature */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Drop-Off Confirmation</h3>
              <p className="text-sm text-gray-500 mb-4">Person who brought the vehicle to the workshop. For corporate accounts, this may be the driver, not the account holder.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
                  <input value={signatureName} onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="Person dropping off the vehicle"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contact Phone <span className="text-red-500">*</span></label>
                  <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Driver's phone number"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-lg" />
                  {selectedCustomer?.phone && contactPhone !== selectedCustomer.phone && (
                    <button
                      type="button"
                      onClick={() => setContactPhone(selectedCustomer.phone)}
                      className="mt-1 text-xs text-primary-600 hover:text-primary-800 underline"
                    >
                      Use owner&apos;s number ({selectedCustomer.phone})
                    </button>
                  )}
                  <p className="mt-1 text-xs text-gray-400">Who to call when the vehicle is ready</p>
                </div>
              </div>

              {/* Customer Signature */}
              <div className="mt-5 pt-5 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-3">Customer Signature *</label>

                {/* Signature captured — show it */}
                {(signatureUrl || signatureDataUrl) ? (
                  <div className="flex items-center gap-4 rounded-lg border border-green-200 bg-green-50 p-4">
                    <img src={signatureUrl ?? signatureDataUrl ?? ''} alt="Customer signature" className="h-16 w-auto rounded border border-green-300 bg-white" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-green-900">Signature captured</p>
                      <p className="text-xs text-green-600">{signatureName || 'Customer'} signed {signatureUrl ? 'via phone' : 'on screen'}</p>
                    </div>
                    <button
                      onClick={() => { setSignatureUrl(null); setSignatureDataUrl(null); setSignatureMode(null); setSignatureSent(false); setSignatureSession(null); setHasSigDrawn(false); }}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold"
                    >
                      Clear
                    </button>
                  </div>
                ) : signatureSent ? (
                  /* Waiting for WhatsApp signature */
                  <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 animate-pulse">
                        <span className="text-xl">&#x270D;&#xFE0F;</span>
                      </div>
                      <div>
                        <p className="font-semibold text-amber-900">Waiting for signature...</p>
                        <p className="text-xs text-amber-700">Link sent to {contactPhone} &mdash; the customer signs on their phone</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setSignatureSent(false); setSignatureSession(null); setSignatureMode(null); }}
                      className="mt-2 text-xs text-amber-700 hover:text-amber-900 underline"
                    >
                      Try a different method
                    </button>
                  </div>
                ) : signatureMode === 'pad' ? (
                  /* On-screen signature pad */
                  <div>
                    <div className="rounded-lg border-2 border-gray-300 bg-white overflow-hidden">
                      <canvas
                        ref={sigCanvasRef}
                        className="w-full touch-none cursor-crosshair"
                        style={{ height: 180 }}
                        onMouseDown={(e) => {
                          setIsSigDrawing(true); setHasSigDrawn(true);
                          const canvas = sigCanvasRef.current; if (!canvas) return;
                          const ctx = canvas.getContext('2d'); if (!ctx) return;
                          const rect = canvas.getBoundingClientRect();
                          // Init canvas size on first draw
                          if (canvas.width !== rect.width * (window.devicePixelRatio || 1)) {
                            const dpr = window.devicePixelRatio || 1;
                            canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
                            ctx.scale(dpr, dpr);
                            ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, rect.width, rect.height);
                            ctx.strokeStyle = '#1C1C1E'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                          }
                          ctx.beginPath(); ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                        }}
                        onMouseMove={(e) => {
                          if (!isSigDrawing) return;
                          const canvas = sigCanvasRef.current; if (!canvas) return;
                          const ctx = canvas.getContext('2d'); if (!ctx) return;
                          const rect = canvas.getBoundingClientRect();
                          ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top); ctx.stroke();
                        }}
                        onMouseUp={() => setIsSigDrawing(false)}
                        onMouseLeave={() => setIsSigDrawing(false)}
                        onTouchStart={(e) => {
                          e.preventDefault(); setIsSigDrawing(true); setHasSigDrawn(true);
                          const canvas = sigCanvasRef.current; if (!canvas) return;
                          const ctx = canvas.getContext('2d'); if (!ctx) return;
                          const rect = canvas.getBoundingClientRect();
                          if (canvas.width !== rect.width * (window.devicePixelRatio || 1)) {
                            const dpr = window.devicePixelRatio || 1;
                            canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
                            ctx.scale(dpr, dpr);
                            ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, rect.width, rect.height);
                            ctx.strokeStyle = '#1C1C1E'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                          }
                          const touch = e.touches[0]; if (!touch) return;
                          ctx.beginPath(); ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
                        }}
                        onTouchMove={(e) => {
                          e.preventDefault(); if (!isSigDrawing) return;
                          const canvas = sigCanvasRef.current; if (!canvas) return;
                          const ctx = canvas.getContext('2d'); if (!ctx) return;
                          const rect = canvas.getBoundingClientRect();
                          const touch = e.touches[0]; if (!touch) return;
                          ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top); ctx.stroke();
                        }}
                        onTouchEnd={() => setIsSigDrawing(false)}
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-400 text-center">Draw signature above with mouse or finger</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => {
                          const canvas = sigCanvasRef.current; if (!canvas) return;
                          const ctx = canvas.getContext('2d'); if (!ctx) return;
                          const rect = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
                          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
                          ctx.scale(dpr, dpr); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, rect.width, rect.height);
                          ctx.strokeStyle = '#1C1C1E'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                          setHasSigDrawn(false);
                        }}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => {
                          const canvas = sigCanvasRef.current;
                          if (canvas && hasSigDrawn) setSignatureDataUrl(canvas.toDataURL('image/png'));
                        }}
                        disabled={!hasSigDrawn}
                        className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-40"
                      >
                        Confirm Signature
                      </button>
                      <button
                        onClick={() => { setSignatureMode(null); setHasSigDrawn(false); }}
                        className="rounded-lg border border-gray-200 px-4 py-2 text-xs text-gray-500 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Choose method */
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSignatureMode('pad')}
                      className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50 p-4 hover:border-primary-400 hover:shadow-sm transition-all"
                    >
                      <span className="text-2xl">&#x270D;&#xFE0F;</span>
                      <span className="text-sm font-bold text-primary-900">Sign Here</span>
                      <span className="text-xs text-primary-600">Customer signs on this screen</span>
                    </button>
                    <button
                      onClick={handleSendSignatureLink}
                      disabled={sendingSignature || !contactPhone.trim()}
                      className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 hover:border-gray-400 hover:shadow-sm transition-all disabled:opacity-40"
                    >
                      <span className="text-2xl">&#x1F4F1;</span>
                      <span className="text-sm font-bold text-gray-900">{sendingSignature ? 'Sending...' : 'Send to Phone'}</span>
                      <span className="text-xs text-gray-500">Via WhatsApp link</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button onClick={handleSubmit} disabled={submitting}
              className="w-full rounded-xl bg-green-600 py-4 text-lg font-bold text-white hover:bg-green-700 disabled:opacity-50 shadow-lg shadow-green-200 transition-all">
              {submitting ? 'Creating Job Card...' : 'Create Job Card'}
            </button>
          </div>
        )}

        {/* ── Navigation ── */}
        {step !== 'review' && (
          <div className="mt-8 flex items-center justify-between">
            {stepIndex > 0 ? (
              <button onClick={goBack} className="rounded-xl border-2 border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:border-gray-300">
                Back
              </button>
            ) : <div />}
            <button onClick={goNext} disabled={!canNext()}
              className="rounded-xl bg-primary-600 px-8 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-40 shadow-md transition-all">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
