/**
 * TaxConfigScreen.tsx
 * Admin — manage rates for all 6 car types + global rates.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { useTaxConfig, buildDefaultConfig, TaxConfigStore } from './useTaxConfig';
import { CarTypeConfig } from './taxConfig';

const CREAM   = '#F7F6F2';
const INK     = '#1A1A18';
const INK2    = '#5C5C58';
const INK3    = '#9B9B96';
const BORDER  = '#E2E0D8';
const ACCENT  = '#1A4731';
const WHITE   = '#FFFFFF';
const DANGER  = '#C0392B';
const WARN_BG = '#FFF8E6';
const WARN_TX = '#92610A';

const toNum   = (s: string) => parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
const toPct   = (s: string) => toNum(s) / 100;
const fromPct = (n: number) => (n * 100).toFixed(1);
const formatDate = (iso: string) => {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const ENGINE_LABELS: Record<string, string> = {
  '1500': '≤ 1,500 cc',
  '2000': '1,501–2,000 cc',
  '3000': '2,001–3,000 cc',
  '3001': '> 3,000 cc',
  'flat': 'All (flat rate)',
};

const RateRow = ({
  label, value, onChange, suffix = '%', hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  suffix?: string; hint?: string;
}) => (
  <View style={s.rateRow}>
    <View style={s.rateRowLeft}>
      <Text style={s.rateLabel}>{label}</Text>
      {hint && <Text style={s.rateHint}>{hint}</Text>}
    </View>
    <View style={s.rateInputWrap}>
      <TextInput style={s.rateInput} value={value} onChangeText={onChange}
        keyboardType="decimal-pad" selectTextOnFocus />
      <Text style={s.rateSuffix}>{suffix}</Text>
    </View>
  </View>
);

interface Props { onBack: () => void; }

const TaxConfigScreen: React.FC<Props> = ({ onBack }) => {
  const { config, saveConfig, resetConfig } = useTaxConfig();

  // Global rates
  const [khrRate, setKhrRate] = useState(config.khrRate.toString());
  const [vat,     setVat]     = useState(fromPct(config.vat));
  const [vvf,     setVvf]     = useState(config.vvfFee.toString());
  const [label,   setLabel]   = useState(config.ratesLabel);

  // Per car type rates: carTypeId → { customsDuty: string, specialRates: Record<string, string> }
  const [typeRates, setTypeRates] = useState<Record<string, {
    customsDuty: string;
    specialRates: Record<string, string>;
  }>>(() => {
    const init: Record<string, any> = {};
    config.carTypes.forEach(t => {
      init[t.id] = {
        customsDuty: fromPct(t.customsDuty),
        specialRates: Object.fromEntries(
          Object.entries(t.specialRates).map(([k, v]) => [k, fromPct(v)])
        ),
      };
    });
    return init;
  });

  const [isDirty, setIsDirty] = useState(false);

  const markDirty = (fn: (v: string) => void) => (v: string) => { fn(v); setIsDirty(true); };

  const setTypeField = (id: string, field: 'customsDuty', val: string) => {
    setTypeRates(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
    setIsDirty(true);
  };

  const setSpecialRate = (id: string, engKey: string, val: string) => {
    setTypeRates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        specialRates: { ...prev[id].specialRates, [engKey]: val },
      },
    }));
    setIsDirty(true);
  };

  const handleSave = useCallback(() => {
    const errors: string[] = [];
    if (toNum(khrRate) < 100) errors.push('KHR rate must be ≥ 100');
    if (toPct(vat) > 1)       errors.push('VAT cannot exceed 100%');
    if (errors.length > 0) { Alert.alert('Check values', errors.join('\n')); return; }

    Alert.alert('Save all rates?', 'Updates apply immediately to new calculations.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save', onPress: async () => {
          const updated: TaxConfigStore = {
            ...config,
            khrRate:    toNum(khrRate),
            vat:        toPct(vat),
            vvfFee:     toNum(vvf),
            ratesLabel: label || 'Custom rates',
            carTypes:   config.carTypes.map(t => ({
              ...t,
              customsDuty: toPct(typeRates[t.id]?.customsDuty ?? fromPct(t.customsDuty)),
              specialRates: Object.fromEntries(
                Object.entries(typeRates[t.id]?.specialRates ?? {}).map(([k, v]) => [k, toPct(v)])
              ),
            })),
          };
          await saveConfig(updated);
          setIsDirty(false);
          Alert.alert('Saved ✓', 'All tax rates updated.');
        },
      },
    ]);
  }, [khrRate, vat, vvf, label, typeRates, config, saveConfig]);

  const handleReset = useCallback(() => {
    Alert.alert('Reset to defaults?', 'Restores all GDCE official rates.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: async () => {
          await resetConfig();
          const def = buildDefaultConfig();
          setKhrRate(def.khrRate.toString());
          setVat(fromPct(def.vat));
          setVvf(def.vvfFee.toString());
          setLabel(def.ratesLabel);
          const init: Record<string, any> = {};
          def.carTypes.forEach(t => {
            init[t.id] = {
              customsDuty: fromPct(t.customsDuty),
              specialRates: Object.fromEntries(
                Object.entries(t.specialRates).map(([k, v]) => [k, fromPct(v as number)])
              ),
            };
          });
          setTypeRates(init);
          setIsDirty(false);
          Alert.alert('Reset ✓', 'Rates restored to defaults.');
        },
      },
    ]);
  }, [resetConfig]);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={onBack}>
          <Text style={s.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Tax Rate Manager</Text>
        <TouchableOpacity style={s.resetBtn} onPress={handleReset}>
          <Text style={s.resetBtnText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={s.lastUpdatedCard}>
          <Text style={s.lastUpdatedLabel}>Last updated</Text>
          <Text style={s.lastUpdatedValue}>{formatDate(config.lastUpdated)}</Text>
        </View>

        {isDirty && (
          <View style={s.warnBanner}>
            <Text style={s.warnText}>⚠ You have unsaved changes</Text>
          </View>
        )}

        {/* Global */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>🌐  Global settings</Text>
          <RateRow label="Rate label"      value={label}   onChange={markDirty(setLabel)}   suffix="" hint="Shown in app header" />
          <View style={s.rowDiv} />
          <RateRow label="Exchange rate"   value={khrRate} onChange={markDirty(setKhrRate)} suffix="KHR/USD" />
          <View style={s.rowDiv} />
          <RateRow label="VOP — VAT"       value={vat}     onChange={markDirty(setVat)}     hint="Applied on CIF+COP+SOP (cascade)" />
          <View style={s.rowDiv} />
          <RateRow label="VVF — Vignette" value={vvf}     onChange={markDirty(setVvf)}     suffix="KHR" hint="Flat fee per vehicle" />
        </View>

        {/* Per car type */}
        {config.carTypes.map(t => (
          <View style={s.card} key={t.id}>
            <Text style={s.sectionTitle}>{t.icon}  {t.name} ({t.nameKh})</Text>
            <Text style={s.sectionDesc}>{t.description}</Text>

            <RateRow
              label="COP — Customs duty"
              value={typeRates[t.id]?.customsDuty ?? fromPct(t.customsDuty)}
              onChange={v => setTypeField(t.id, 'customsDuty', v)}
              hint="Applied on CIF"
            />

            <View style={s.rowDiv} />
            <Text style={s.subLabel}>SOP — Special tax rates</Text>

            {Object.entries(t.specialRates).map(([engKey, _]) => (
              <View key={engKey}>
                <RateRow
                  label={ENGINE_LABELS[engKey] ?? engKey}
                  value={typeRates[t.id]?.specialRates[engKey] ?? fromPct(_ as number)}
                  onChange={v => setSpecialRate(t.id, engKey, v)}
                  hint={engKey === 'flat' ? 'Same rate for all engine sizes' : undefined}
                />
                {engKey !== Object.keys(t.specialRates).at(-1) && <View style={s.rowDiv} />}
              </View>
            ))}

            {t.note && (
              <View style={s.noteBox}>
                <Text style={s.noteText}>{t.note}</Text>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={[s.saveBtn, !isDirty && s.saveBtnDisabled]}
          onPress={handleSave} activeOpacity={isDirty ? 0.8 : 1}>
          <Text style={[s.saveBtnText, !isDirty && s.saveBtnTextDisabled]}>
            {isDirty ? 'Save all changes' : 'No changes to save'}
          </Text>
        </TouchableOpacity>

        <Text style={s.disclaimer}>
          Formula: COP = CIF × duty%  ·  SOP = (CIF+COP) × rate%  ·  VOP = (CIF+COP+SOP) × vat%
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: BORDER, backgroundColor: WHITE },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backBtnText: { fontSize: 15, color: ACCENT, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: INK },
  resetBtn: { paddingVertical: 6, paddingLeft: 12 },
  resetBtnText: { fontSize: 14, color: DANGER },
  lastUpdatedCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: WHITE, borderRadius: 12, padding: 14, marginBottom: 10, marginTop: 12, borderWidth: 0.5, borderColor: BORDER },
  lastUpdatedLabel: { fontSize: 11, color: INK3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  lastUpdatedValue: { fontSize: 13, color: INK2, fontWeight: '500' },
  warnBanner: { backgroundColor: WARN_BG, borderRadius: 10, padding: 12, marginBottom: 10, alignItems: 'center' },
  warnText: { fontSize: 13, color: WARN_TX, fontWeight: '600' },
  card: { backgroundColor: WHITE, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: BORDER },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 4 },
  sectionDesc: { fontSize: 12, color: INK3, marginBottom: 14 },
  subLabel: { fontSize: 11, fontWeight: '600', color: INK3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  rateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  rateRowLeft: { flex: 1 },
  rateLabel: { fontSize: 14, color: INK, fontWeight: '500' },
  rateHint: { fontSize: 11, color: INK3, marginTop: 2 },
  rateInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: CREAM, borderRadius: 10, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 10, height: 42, minWidth: 110 },
  rateInput: { flex: 1, fontSize: 16, fontWeight: '700', color: ACCENT, textAlign: 'right', padding: 0 },
  rateSuffix: { fontSize: 13, color: INK3, marginLeft: 4, fontWeight: '500' },
  rowDiv: { height: 0.5, backgroundColor: BORDER, marginVertical: 10 },
  noteBox: { marginTop: 12, backgroundColor: '#E6F7EF', borderRadius: 8, padding: 10 },
  noteText: { fontSize: 12, color: '#0B5C34', fontWeight: '500' },
  saveBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  saveBtnDisabled: { backgroundColor: BORDER },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: WHITE },
  saveBtnTextDisabled: { color: INK3 },
  disclaimer: { fontSize: 11, color: INK3, lineHeight: 17, textAlign: 'center' },
});

export default TaxConfigScreen;
