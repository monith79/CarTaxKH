/**
 * CarImportTaxScreen.tsx
 * Calculator screen — receives selected carTypeId from CarTypeSelectScreen.
 * Uses GDCE cascade formula verified from Vehicle Document 2022 V 646-3.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, StatusBar, SafeAreaView,
  Share, Alert, Modal, FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTaxConfig } from './useTaxConfig';
import { ENGINE_OPTIONS, HISTORY_KEY, MAX_HISTORY, CarTypeConfig } from './taxConfig';

// ─── Design tokens ────────────────────────────────────────────────────────────
const CREAM  = '#F7F6F2';
const INK    = '#1A1A18';
const INK2   = '#5C5C58';
const INK3   = '#9B9B96';
const BORDER = '#E2E0D8';
const ACCENT = '#1A4731';
const WHITE  = '#FFFFFF';
const DANGER = '#C0392B';
const INFO_BG = '#EEF4FF';
const INFO_TX = '#2A52A0';
const EV_BG  = '#E6F7EF';
const EV_TX  = '#0B5C34';

type EngineKey  = typeof ENGINE_OPTIONS[number]['key'];
type Currency   = 'KHR' | 'USD';

interface TaxResult {
  cif: number; dutyRate: number; duty: number; dutyBase: number;
  specialRate: number; special: number; specialBase: number;
  vatRate: number; vat: number; vatBase: number;
  vvf: number; total: number; totalUSD: number; landed: number;
}

interface HistoryEntry {
  id: string; date: string; carTypeId: string; carTypeName: string;
  engine: string; fob: number; freight: number;
  khrRate: number; result: TaxResult;
}

// ─── GDCE cascade formula ─────────────────────────────────────────────────────
const calcTax = (
  fobUSD: number, freightUSD: number, khrRate: number,
  customsDuty: number, specialRate: number,
  vatRate: number, vvfFee: number,
): TaxResult => {
  const cif         = (fobUSD + freightUSD) * khrRate;
  const dutyBase    = cif;
  const duty        = dutyBase * customsDuty;
  const specialBase = cif + duty;
  const special     = specialBase * specialRate;
  const vatBase     = cif + duty + special;
  const vat         = vatBase * vatRate;
  const vvf         = vvfFee;
  const total       = duty + special + vat + vvf;
  return {
    cif, dutyRate: customsDuty, duty, dutyBase,
    specialRate, special, specialBase,
    vatRate, vat, vatBase,
    vvf, total, totalUSD: total / khrRate, landed: cif + total,
  };
};

const fmtKHR     = (n: number) => '៛' + Math.round(n).toLocaleString('en-US');
const fmtUSD     = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct        = (r: number) => `${Math.round(r * 100)}%`;
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── SegmentControl ───────────────────────────────────────────────────────────
function SegmentControl<T extends string>({
  options, value, onChange,
}: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.segment}>
      {options.map(opt => (
        <TouchableOpacity key={opt.key}
          style={[s.segItem, value === opt.key && s.segAct]}
          onPress={() => onChange(opt.key)} activeOpacity={0.7}>
          <Text style={[s.segText, value === opt.key && s.segTextAct]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── TaxRow ───────────────────────────────────────────────────────────────────
const TaxRow = ({ label, code, base, rate, amount }: {
  label: string; code: string; base: number; rate: string; amount: number;
}) => (
  <View style={s.taxRow}>
    <View style={s.taxRowTop}>
      <View style={s.taxRowLeft}>
        <Text style={s.taxRowLabel}>{label}</Text>
        <View style={s.codeTag}><Text style={s.codeTagText}>{code}</Text></View>
        <View style={s.rateBadge}><Text style={s.rateBadgeText}>{rate}</Text></View>
      </View>
      <Text style={s.taxRowAmount}>{fmtKHR(amount)}</Text>
    </View>
    <Text style={s.taxRowBase}>Base: {fmtKHR(base)}</Text>
  </View>
);

// ─── History Modal ────────────────────────────────────────────────────────────
const HistoryModal = ({ visible, history, currency, khrRate, onClose, onLoad, onClear }: {
  visible: boolean; history: HistoryEntry[]; currency: Currency; khrRate: number;
  onClose: () => void; onLoad: (e: HistoryEntry) => void; onClear: () => void;
}) => {
  const fmt = (n: number) => currency === 'USD' ? fmtUSD(n / khrRate) : fmtKHR(n);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={s.modalSafe}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Calculation history</Text>
          <View style={s.modalHeaderRight}>
            {history.length > 0 && (
              <TouchableOpacity onPress={onClear} style={s.clearBtn}>
                <Text style={s.clearBtnText}>Clear all</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
        {history.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyTitle}>No calculations yet</Text>
            <Text style={s.emptyText}>Save a calculation and it will appear here.</Text>
          </View>
        ) : (
          <FlatList data={history} keyExtractor={i => i.id}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.historyItem}
                onPress={() => { onLoad(item); onClose(); }} activeOpacity={0.75}>
                <View style={s.historyItemTop}>
                  <View style={s.historyTags}>
                    <View style={s.tag}><Text style={s.tagText}>{item.carTypeName}</Text></View>
                    {item.engine !== 'flat' && (
                      <View style={s.tag}><Text style={s.tagText}>{item.engine}</Text></View>
                    )}
                  </View>
                  <Text style={s.historyDate}>{formatDate(item.date)}</Text>
                </View>
                <View style={s.historyItemBottom}>
                  <View>
                    <Text style={s.historySmall}>CIF</Text>
                    <Text style={s.historyFob}>{fmt(item.result.cif)}</Text>
                  </View>
                  <View style={s.historyRight}>
                    <Text style={s.historySmall}>Total tax</Text>
                    <Text style={s.historyTotal}>{fmt(item.result.total)}</Text>
                  </View>
                </View>
                <Text style={s.historyTap}>Tap to load →</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
interface Props {
  carTypeId:     string;
  onBack:        () => void;
  onManageRates: () => void;
}

const CarImportTaxScreen: React.FC<Props> = ({ carTypeId, onBack, onManageRates }) => {
  const { config, getCarType } = useTaxConfig();
  const carType = getCarType(carTypeId);

  const [engine,       setEngine]       = useState<EngineKey>('2000');
  const [fobInput,     setFobInput]     = useState('');
  const [freightInput, setFreightInput] = useState('0');
  const [currency,     setCurrency]     = useState<Currency>('KHR');
  const [history,      setHistory]      = useState<HistoryEntry[]>([]);
  const [historyOpen,  setHistoryOpen]  = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(raw => { if (raw) setHistory(JSON.parse(raw)); });
  }, []);

  const fob     = parseFloat(fobInput.replace(/,/g, ''))     || 0;
  const freight = parseFloat(freightInput.replace(/,/g, '')) || 0;

  const specialRate = carType.engineBased
    ? (carType.specialRates[engine] ?? 0)
    : (carType.specialRates['flat'] ?? 0);

  const result = calcTax(fob, freight, config.khrRate, carType.customsDuty, specialRate, config.vat, config.vvfFee);

  const fmt    = useCallback((khrAmt: number) =>
    currency === 'USD' ? fmtUSD(khrAmt / config.khrRate) : fmtKHR(khrAmt),
  [currency, config.khrRate]);

  const taxPct = result.cif > 0 ? Math.round((result.total / result.cif) * 100) : 0;
  const isGreen = carType.id === 'ev' || carType.id === 'phev' || carType.id === 'hybrid';

  const persist = useCallback(async (entries: HistoryEntry[]) => {
    setHistory(entries);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  }, []);

  const handleSave = useCallback(() => {
    if (fob === 0) { Alert.alert('No data', 'Enter a car value before saving.'); return; }
    const entry: HistoryEntry = {
      id: Date.now().toString(), date: new Date().toISOString(),
      carTypeId, carTypeName: `${carType.icon} ${carType.name}`,
      engine: carType.engineBased ? engine : 'flat',
      fob, freight, khrRate: config.khrRate, result,
    };
    persist([entry, ...history].slice(0, MAX_HISTORY));
    Alert.alert('Saved ✓', 'Calculation saved to history.');
  }, [carTypeId, carType, engine, fob, freight, result, history, persist, config.khrRate]);

  const handleShare = useCallback(async () => {
    if (fob === 0) { Alert.alert('No data', 'Enter a car value before sharing.'); return; }
    const engLabel = carType.engineBased
      ? ENGINE_OPTIONS.find(e => e.key === engine)?.label ?? engine
      : 'N/A';
    const lines = [
      '🇰🇭 Cambodia Car Import Tax — GDCE Official Method',
      '══════════════════════════════════════════',
      `Car type:    ${carType.icon} ${carType.name} (${carType.nameKh})`,
      `Engine:      ${engLabel}`,
      `KHR rate:    ៛${config.khrRate}/USD`,
      '',
      `FOB cost:    ${fmtUSD(fob)}  →  ${fmtKHR(fob * config.khrRate)}`,
      `Freight:     ${fmtUSD(freight)}`,
      `CIF value:   ${fmtKHR(result.cif)}`,
      '',
      `COP (${pct(result.dutyRate)}) Base: ${fmtKHR(result.dutyBase)}  →  ${fmtKHR(result.duty)}`,
      `SOP (${pct(result.specialRate)}) Base: ${fmtKHR(result.specialBase)}  →  ${fmtKHR(result.special)}`,
      `VOP (${pct(result.vatRate)}) Base: ${fmtKHR(result.vatBase)}  →  ${fmtKHR(result.vat)}`,
      `VVF flat  →  ${fmtKHR(result.vvf)}`,
      '══════════════════════════════════════════',
      `Total tax:   ${fmtKHR(result.total)}  (≈ ${fmtUSD(result.totalUSD)})`,
      `Landed cost: ${fmtKHR(result.landed)}`,
      '',
      `Calculated with CarTaxKH · ${config.ratesLabel}`,
    ];
    await Share.share({ message: lines.join('\n'), title: 'Cambodia Car Import Tax' });
  }, [carType, engine, fob, freight, result, config]);

  const handleLoad = useCallback((entry: HistoryEntry) => {
    if (entry.engine !== 'flat') setEngine(entry.engine as EngineKey);
    setFobInput(entry.fob.toString());
    setFreightInput(entry.freight.toString());
  }, []);

  const handleClear = useCallback(() => {
    Alert.alert('Clear history', 'Remove all saved calculations?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => persist([]) },
    ]);
  }, [persist]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={CREAM} />
      <ScrollView style={s.scroll} contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={onBack}>
            <Text style={s.backBtnText}>← Change type</Text>
          </TouchableOpacity>
          <View style={s.headerBtns}>
            <TouchableOpacity style={s.headerBtn} onPress={() => setHistoryOpen(true)}>
              <Text style={s.headerBtnText}>History{history.length > 0 ? ` (${history.length})` : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.headerBtn, s.headerBtnAccent]} onPress={onManageRates}>
              <Text style={s.headerBtnAccentText}>⚙ Rates</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Car type badge */}
        <View style={[s.carTypeBadge, isGreen && s.carTypeBadgeGreen]}>
          <Text style={s.carTypeBadgeIcon}>{carType.icon}</Text>
          <View>
            <Text style={[s.carTypeBadgeName, isGreen && s.carTypeBadgeNameGreen]}>
              {carType.name}
            </Text>
            <Text style={[s.carTypeBadgeDesc, isGreen && s.carTypeBadgeDescGreen]}>
              {carType.description}
              {carType.note ? `  ·  ${carType.note}` : ''}
            </Text>
          </View>
        </View>

        {/* Currency */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>Display currency</Text>
          <SegmentControl
            options={[{ key: 'KHR' as Currency, label: '🇰🇭  KHR – Riel' }, { key: 'USD' as Currency, label: '🇺🇸  USD' }]}
            value={currency} onChange={setCurrency} />
          <Text style={s.khrNote}>$1 = ៛{config.khrRate.toLocaleString()}</Text>
        </View>

        {/* Engine selector (only for engine-based types) */}
        {carType.engineBased && (
          <View style={s.card}>
            <Text style={s.sectionLabel}>Engine displacement</Text>
            <View style={s.engineGrid}>
              {ENGINE_OPTIONS.map(opt => (
                <TouchableOpacity key={opt.key}
                  style={[s.engineItem, engine === opt.key && s.engineItemActive]}
                  onPress={() => setEngine(opt.key)} activeOpacity={0.7}>
                  <Text style={[s.engineText, engine === opt.key && s.engineTextActive]}>
                    {opt.label}
                  </Text>
                  <Text style={[s.engineRate, engine === opt.key && s.engineRateActive]}>
                    SOP {pct(carType.specialRates[opt.key] ?? 0)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Car value */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>Car value (USD)</Text>
          <View style={s.inputRow}>
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>FOB cost</Text>
              <View style={s.inputWrap}>
                <Text style={s.inputPrefix}>$</Text>
                <TextInput style={s.input} keyboardType="decimal-pad"
                  value={fobInput} onChangeText={setFobInput}
                  placeholder="e.g. 9500" placeholderTextColor={INK3} selectTextOnFocus />
              </View>
            </View>
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>Insurance + Freight</Text>
              <View style={s.inputWrap}>
                <Text style={s.inputPrefix}>$</Text>
                <TextInput style={s.input} keyboardType="decimal-pad"
                  value={freightInput} onChangeText={setFreightInput}
                  placeholder="0" placeholderTextColor={INK3} selectTextOnFocus />
              </View>
            </View>
          </View>
          <View style={s.cifRow}>
            <Text style={s.cifNote}>CIF value (tax base)</Text>
            <Text style={s.cifValue}>{fmtKHR(result.cif)}</Text>
          </View>
        </View>

        {/* Result */}
        <View style={s.resultCard}>
          <View style={s.resultHeader}>
            <Text style={s.resultTitle}>Tax breakdown</Text>
            <View style={s.taxPctBadge}><Text style={s.taxPctText}>{taxPct}% of CIF</Text></View>
          </View>
          <TaxRow label="Customs duty" code="COP" base={result.dutyBase}    rate={pct(result.dutyRate)}    amount={result.duty}    />
          <TaxRow label="Special tax"  code="SOP" base={result.specialBase} rate={pct(result.specialRate)} amount={result.special} />
          <TaxRow label="VAT"          code="VOP" base={result.vatBase}     rate={pct(result.vatRate)}     amount={result.vat}     />
          <View style={s.vvfRow}>
            <View style={s.taxRowLeft}>
              <Text style={s.taxRowLabel}>Vignette fee</Text>
              <View style={s.codeTag}><Text style={s.codeTagText}>VVF</Text></View>
              <View style={s.rateBadge}><Text style={s.rateBadgeText}>flat</Text></View>
            </View>
            <Text style={s.taxRowAmount}>{fmtKHR(result.vvf)}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total import tax</Text>
            <View style={s.totalValueWrap}>
              <Text style={s.totalValue}>{fmt(result.total)}</Text>
              {currency === 'KHR'
                ? <Text style={s.totalValueSub}>≈ {fmtUSD(result.totalUSD)}</Text>
                : <Text style={s.totalValueSub}>{fmtKHR(result.total)}</Text>
              }
            </View>
          </View>
          <View style={s.landedRow}>
            <Text style={s.landedLabel}>Landed cost (CIF + taxes)</Text>
            <Text style={s.landedValue}>{fmt(result.landed)}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.btnSave} onPress={handleSave} activeOpacity={0.8}>
            <Text style={s.btnSaveText}>💾  Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnShare} onPress={handleShare} activeOpacity={0.8}>
            <Text style={s.btnShareText}>↑  Share</Text>
          </TouchableOpacity>
        </View>

        {/* Formula */}
        <View style={s.formulaCard}>
          <Text style={s.formulaTitle}>GDCE formula (official)</Text>
          <Text style={s.formulaLine}>CIF = FOB × ៛{config.khrRate.toLocaleString()}/USD</Text>
          <Text style={s.formulaLine}>COP = CIF × {pct(carType.customsDuty)}</Text>
          <Text style={s.formulaLine}>SOP = (CIF + COP) × {pct(specialRate)}</Text>
          <Text style={s.formulaLine}>VOP = (CIF + COP + SOP) × {pct(config.vat)}</Text>
          <Text style={s.formulaLine}>VVF = ៛{config.vvfFee.toLocaleString()} flat</Text>
        </View>

        <Text style={s.disclaimer}>
          {config.ratesLabel}. Formula verified from GDCE Vehicle Document 2022 V 646-3.
        </Text>
      </ScrollView>

      <HistoryModal visible={historyOpen} history={history} currency={currency}
        khrRate={config.khrRate} onClose={() => setHistoryOpen(false)}
        onLoad={handleLoad} onClear={handleClear} />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  scroll: { flex: 1 },
  container: { padding: 20, paddingBottom: 48 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backBtnText: { fontSize: 13, color: ACCENT, fontWeight: '600' },
  headerBtns: { flexDirection: 'row', gap: 8 },
  headerBtn: { backgroundColor: WHITE, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, borderColor: BORDER },
  headerBtnText: { fontSize: 12, fontWeight: '500', color: INK2 },
  headerBtnAccent: { backgroundColor: ACCENT, borderColor: ACCENT },
  headerBtnAccentText: { fontSize: 12, fontWeight: '600', color: WHITE },

  carTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: WHITE, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 0.5, borderColor: BORDER },
  carTypeBadgeGreen: { backgroundColor: EV_BG, borderColor: '#A8D5B5' },
  carTypeBadgeIcon: { fontSize: 32 },
  carTypeBadgeName: { fontSize: 16, fontWeight: '700', color: INK },
  carTypeBadgeNameGreen: { color: EV_TX },
  carTypeBadgeDesc: { fontSize: 12, color: INK3, marginTop: 2 },
  carTypeBadgeDescGreen: { color: EV_TX },

  card: { backgroundColor: WHITE, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: BORDER },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: INK3, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 12 },

  segment: { flexDirection: 'row', backgroundColor: CREAM, borderRadius: 10, padding: 3, gap: 3 },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segAct: { backgroundColor: WHITE, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segText: { fontSize: 13, fontWeight: '500', color: INK3 },
  segTextAct: { color: INK },
  khrNote: { marginTop: 8, fontSize: 12, color: INK3, textAlign: 'center' },

  engineGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  engineItem: { width: '47.5%', borderRadius: 10, borderWidth: 1, borderColor: BORDER, padding: 12, backgroundColor: CREAM },
  engineItemActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  engineText: { fontSize: 13, fontWeight: '600', color: INK, marginBottom: 3 },
  engineTextActive: { color: WHITE },
  engineRate: { fontSize: 11, color: INK3 },
  engineRateActive: { color: 'rgba(255,255,255,0.7)' },

  inputRow: { flexDirection: 'row', gap: 10 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 12, color: INK3, marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: CREAM, borderRadius: 10, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 10, height: 44 },
  inputPrefix: { fontSize: 15, color: INK2, marginRight: 4 },
  input: { flex: 1, fontSize: 15, fontWeight: '600', color: INK, padding: 0 },
  cifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  cifNote: { fontSize: 13, color: INK3 },
  cifValue: { fontSize: 14, fontWeight: '700', color: INK },

  resultCard: { backgroundColor: ACCENT, borderRadius: 16, padding: 20, marginBottom: 12 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  resultTitle: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.9 },
  taxPctBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  taxPctText: { fontSize: 12, fontWeight: '600', color: WHITE },

  taxRow: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.12)' },
  taxRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  taxRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  taxRowLabel: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  codeTag: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  codeTagText: { fontSize: 10, color: WHITE, fontWeight: '700', letterSpacing: 0.5 },
  rateBadge: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  rateBadgeText: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  taxRowAmount: { fontSize: 14, fontWeight: '700', color: WHITE },
  taxRowBase: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },

  vvfRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  totalLabel: { fontSize: 15, fontWeight: '600', color: WHITE, marginTop: 4 },
  totalValueWrap: { alignItems: 'flex-end' },
  totalValue: { fontSize: 26, fontWeight: '700', color: WHITE, letterSpacing: -0.5 },
  totalValueSub: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  landedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 10, padding: 12 },
  landedLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  landedValue: { fontSize: 15, fontWeight: '700', color: WHITE },

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  btnSave: { flex: 1, backgroundColor: WHITE, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 0.5, borderColor: BORDER },
  btnSaveText: { fontSize: 15, fontWeight: '600', color: INK },
  btnShare: { flex: 1, backgroundColor: INK, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnShareText: { fontSize: 15, fontWeight: '600', color: WHITE },

  formulaCard: { backgroundColor: WHITE, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: BORDER },
  formulaTitle: { fontSize: 11, fontWeight: '600', color: INK3, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 10 },
  formulaLine: { fontSize: 12, color: INK2, fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }), lineHeight: 22 },

  disclaimer: { fontSize: 11, color: INK3, lineHeight: 17, textAlign: 'center' },

  modalSafe: { flex: 1, backgroundColor: CREAM },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  modalTitle: { fontSize: 18, fontWeight: '700', color: INK },
  modalHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  clearBtnText: { fontSize: 13, color: DANGER, fontWeight: '500' },
  closeBtn: { backgroundColor: INK, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  closeBtnText: { fontSize: 13, fontWeight: '600', color: WHITE },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: INK, marginBottom: 8 },
  emptyText: { fontSize: 14, color: INK3, textAlign: 'center', paddingHorizontal: 40 },
  historyItem: { backgroundColor: WHITE, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: BORDER },
  historyItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  historyTags: { flexDirection: 'row', gap: 6 },
  tag: { backgroundColor: CREAM, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: BORDER },
  tagText: { fontSize: 11, fontWeight: '600', color: INK2 },
  historyDate: { fontSize: 11, color: INK3 },
  historyItemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  historySmall: { fontSize: 11, color: INK3, marginBottom: 2 },
  historyFob: { fontSize: 15, fontWeight: '600', color: INK },
  historyRight: { alignItems: 'flex-end' },
  historyTotal: { fontSize: 18, fontWeight: '700', color: ACCENT },
  historyTap: { fontSize: 11, color: INK3, marginTop: 10, textAlign: 'right' },
});

export default CarImportTaxScreen;
