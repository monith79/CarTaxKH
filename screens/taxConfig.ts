/**
 * taxConfig.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Default tax rates for all Cambodia car import types.
 * Edit via the in-app Tax Rate Manager — no coding needed.
 *
 * FORMULA (verified from GDCE Vehicle Document 2022 V 646-3):
 *   CIF         = FOB × KHR rate
 *   COP         = CIF × customsDuty%
 *   SOP         = (CIF + COP) × specialRate%
 *   VOP         = (CIF + COP + SOP) × vat%
 *   VVF         = flat ៛40,000 vignette fee
 *   Total       = COP + SOP + VOP + VVF
 *
 * RATES UPDATED: GDCE 2025–2026 + April 2026 EV/HEV/PHEV reductions
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const KHR_RATE  = 4100;   // 1 USD ≈ KHR
export const VAT_RATE  = 0.10;   // 10% — VOP (same for all types)
export const VVF_FEE   = 40000;  // ៛40,000 flat vignette fee — VVF

export const RATES_LABEL = 'GDCE 2025–2026 + Apr 2026';

// Engine size options (used for engine-based car types)
export const ENGINE_OPTIONS = [
  { key: '1500', label: '≤ 1,500 cc' },
  { key: '2000', label: '1,501–2,000 cc' },
  { key: '3000', label: '2,001–3,000 cc' },
  { key: '3001', label: '> 3,000 cc' },
] as const;

export type EngineKey = typeof ENGINE_OPTIONS[number]['key'];

// ─── Car type definitions ─────────────────────────────────────────────────────

export interface CarTypeConfig {
  id:           string;
  name:         string;          // Display name
  nameKh:       string;          // Khmer name
  icon:         string;          // Emoji icon
  description:  string;          // Short description
  customsDuty:  number;          // COP rate
  engineBased:  boolean;         // true = show engine selector
  specialRates: Record<string, number>; // engine key → SOP rate
  note?:        string;          // optional notice (e.g. incentive info)
}

export const CAR_TYPES: CarTypeConfig[] = [
  {
    id:          'petrol',
    name:        'Petrol',
    nameKh:      'សាំង',
    icon:        '⛽',
    description: 'Gasoline engine',
    customsDuty: 0.35,
    engineBased: true,
    specialRates: { '1500': 0.20, '2000': 0.30, '3000': 0.35, '3001': 0.50 },
  },
  {
    id:          'diesel',
    name:        'Diesel',
    nameKh:      'ម៉ាស៊ូត',
    icon:        '🛢',
    description: 'Diesel engine',
    customsDuty: 0.35,
    engineBased: true,
    specialRates: { '1500': 0.20, '2000': 0.20, '3000': 0.30, '3001': 0.35 },
  },
  {
    id:          'hybrid',
    name:        'Hybrid (HEV)',
    nameKh:      'ហ្វីប្រីត',
    icon:        '🔋',
    description: 'Self-charging hybrid',
    customsDuty: 0.00,           // 0% from April 2026
    engineBased: true,
    specialRates: { '1500': 0.20, '2000': 0.30, '3000': 0.35, '3001': 0.50 },
    note:        '✦ COP 0% incentive (April 2026)',
  },
  {
    id:          'phev',
    name:        'Plug-in Hybrid (PHEV)',
    nameKh:      'PHEV',
    icon:        '🔌',
    description: 'Plug-in hybrid electric',
    customsDuty: 0.07,           // 7% from April 2026
    engineBased: false,
    specialRates: { flat: 0.10 },
    note:        '✦ COP 7% incentive (April 2026)',
  },
  {
    id:          'ev',
    name:        'Pure Electric (EV)',
    nameKh:      'អគ្គិសនី',
    icon:        '⚡',
    description: 'Battery electric vehicle',
    customsDuty: 0.00,           // 0% from April 2026
    engineBased: false,
    specialRates: { flat: 0.10 },
    note:        '✦ COP 0% + EV incentive (April 2026)',
  },
  {
    id:          'pickup',
    name:        'Pickup / Commercial',
    nameKh:      'ពាណិជ្ជកម្ម',
    icon:        '🚐',
    description: 'Pickup trucks & vans',
    customsDuty: 0.35,
    engineBased: true,
    specialRates: { '1500': 0.10, '2000': 0.10, '3000': 0.15, '3001': 0.15 },
  },
];

// ─── Storage keys ─────────────────────────────────────────────────────────────
export const MAX_HISTORY = 20;
export const HISTORY_KEY = '@car_tax_history_v2';
export const CONFIG_KEY  = '@tax_config_v2';
