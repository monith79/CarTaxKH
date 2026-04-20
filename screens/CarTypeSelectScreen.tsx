/**
 * CarTypeSelectScreen.tsx
 * Screen 1 — Select car type + enter FOB price + see instant estimate per card.
 * Shows KHR and USD on every rate and estimate.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTaxConfig } from './useTaxConfig';
import { CarTypeConfig } from './taxConfig';

// ─── Design tokens ────────────────────────────────────────────────────────────
const CREAM   = '#F7F6F2';
const INK     = '#1A1A18';
const INK2    = '#5C5C58';
const INK3    = '#9B9B96';
const BORDER  = '#E2E0D8';
const ACCENT  = '#1A4731';
const WHITE   = '#FFFFFF';
const EV_BG   = '#E6F7EF';
const EV_TX   = '#0B5C34';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pct    = (r: number) => `${Math.round(r * 100)}%`;
const fmtKHR = (n: number) => '៛' + Math.round(n).toLocaleString('en-US');
const fmtUSD = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Quick estimate using GDCE cascade formula
const quickEstimate = (
  fobUSD: number, khrRate: number,
  customsDuty: number, specialRate: number,
  vat: number, vvf: number,
) => {
  if (fobUSD <= 0) return null;
  const cif     = fobUSD * khrRate;
  const duty    = cif * customsDuty;
  const special = (cif + duty) * specialRate;
  const vatAmt  = (cif + duty + special) * vat;
  const total   = duty + special + vatAmt + vvf;
  return { cif, total, landed: cif + total };
};

// ─── Car type card ────────────────────────────────────────────────────────────
const CarTypeCard = ({
  type, selected, onPress, fobUSD, khrRate, vat, vvf,
}: {
  type: CarTypeConfig; selected: boolean; onPress: () => void;
  fobUSD: number; khrRate: number; vat: number; vvf: number;
}) => {
  const isGreen  = type.id === 'ev' || type.id === 'phev' || type.id === 'hybrid';
  const maxSOP   = Math.max(...Object.values(type.specialRates));
  const minSOP   = Math.min(...Object.values(type.specialRates));
  const sopLabel = type.engineBased
    ? `${pct(minSOP)}–${pct(maxSOP)}`
    : pct(Object.values(type.specialRates)[0]);

  // Estimate using midpoint SOP rate for quick preview
  const midSOP    = type.engineBased ? (minSOP + maxSOP) / 2 : Object.values(type.specialRates)[0];
  const estimate  = quickEstimate(fobUSD, khrRate, type.customsDuty, midSOP, vat, vvf);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        selected && styles.cardSelected,
        isGreen && !selected && styles.cardGreen,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {selected && (
        <View style={styles.checkmark}><Text style={styles.checkmarkText}>✓</Text></View>
      )}

      <Text style={styles.cardIcon}>{type.icon}</Text>
      <Text style={[styles.cardName, selected && styles.whiteText]}>{type.name}</Text>
      <Text style={[styles.cardNameKh, selected && styles.white60]}>{type.nameKh}</Text>

      {/* Rate pills: COP + SOP */}
      <View style={styles.pillRow}>
        <View style={[styles.pill, selected && styles.pillSelected]}>
          <Text style={[styles.pillLabel, selected && styles.white70]}>COP</Text>
          <Text style={[styles.pillValue, selected && styles.whiteText]}>{pct(type.customsDuty)}</Text>
        </View>
        <View style={[styles.pill, selected && styles.pillSelected]}>
          <Text style={[styles.pillLabel, selected && styles.white70]}>SOP</Text>
          <Text style={[styles.pillValue, selected && styles.whiteText]}>{sopLabel}</Text>
        </View>
      </View>

      {/* USD estimate (shows when FOB is entered) */}
      {estimate ? (
        <View style={[styles.estimateBox, selected && styles.estimateBoxSelected]}>
          <Text style={[styles.estimateLabel, selected && styles.white60]}>
            Est. total tax
          </Text>
          <Text style={[styles.estimateKHR, selected && styles.whiteText]}>
            {fmtKHR(estimate.total)}
          </Text>
          <Text style={[styles.estimateUSD, selected && styles.white70]}>
            ≈ {fmtUSD(estimate.total / khrRate)}
          </Text>
          <Text style={[styles.estimateLanded, selected && styles.white60]}>
            Landed: {fmtUSD(estimate.landed / khrRate)}
          </Text>
        </View>
      ) : (
        <Text style={[styles.estimatePlaceholder, selected && styles.white60]}>
          Enter price above to see estimate
        </Text>
      )}

      {type.note && (
        <Text style={[styles.cardNote, selected && styles.white70]}>{type.note}</Text>
      )}
    </TouchableOpacity>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
interface Props {
  onNext:        (carTypeId: string) => void;
  onManageRates: () => void;
}

const CarTypeSelectScreen: React.FC<Props> = ({ onNext, onManageRates }) => {
  const { config, saveConfig } = useTaxConfig();
  const [selectedId,  setSelectedId]  = useState('petrol');
  const [fobInput,    setFobInput]    = useState('');
  const [freightInput,setFreightInput]= useState('0');
  const [khrInput,    setKhrInput]    = useState(config.khrRate.toString());
  const [khrEditing,  setKhrEditing]  = useState(false);

  const fob     = parseFloat(fobInput.replace(/,/g, ''))     || 0;
  const freight = parseFloat(freightInput.replace(/,/g, '')) || 0;
  const fobTotal = fob + freight;

  const handleKhrSave = useCallback(async () => {
    const val = parseFloat(khrInput) || config.khrRate;
    setKhrInput(val.toString());
    setKhrEditing(false);
    await saveConfig({ ...config, khrRate: val });
  }, [khrInput, config, saveConfig]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTag}>🇰🇭  CarTaxKH</Text>
          <Text style={styles.appTitle}>Car Import Tax</Text>
          <Text style={styles.appSub}>{config.ratesLabel}</Text>
        </View>
        <TouchableOpacity style={styles.manageBtn} onPress={onManageRates}>
          <Text style={styles.manageBtnText}>⚙ Manage</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Exchange rate ── */}
        <View style={styles.khrCard}>
          <View style={styles.khrLeft}>
            <Text style={styles.khrLabel}>Exchange rate</Text>
            <Text style={styles.khrNote}>$1 USD =</Text>
          </View>
          <View style={styles.khrRight}>
            {khrEditing ? (
              <View style={styles.khrEditRow}>
                <TextInput
                  style={styles.khrInput} value={khrInput}
                  onChangeText={setKhrInput} keyboardType="numeric"
                  autoFocus selectTextOnFocus
                  onBlur={handleKhrSave} onSubmitEditing={handleKhrSave} />
                <Text style={styles.khrUnit}>KHR</Text>
                <TouchableOpacity style={styles.khrSaveBtn} onPress={handleKhrSave}>
                  <Text style={styles.khrSaveBtnText}>OK</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.khrDisplay} onPress={() => setKhrEditing(true)}>
                <Text style={styles.khrValue}>៛{parseFloat(khrInput).toLocaleString()}</Text>
                <Text style={styles.khrEditHint}>tap to edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Car price input ── */}
        <View style={styles.priceCard}>
          <Text style={styles.sectionLabel}>Enter car price for estimate</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>FOB cost (USD)</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputPrefix}>$</Text>
                <TextInput
                  style={styles.input} keyboardType="decimal-pad"
                  value={fobInput} onChangeText={setFobInput}
                  placeholder="e.g. 15000" placeholderTextColor={INK3}
                  selectTextOnFocus />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Insurance + Freight</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputPrefix}>$</Text>
                <TextInput
                  style={styles.input} keyboardType="decimal-pad"
                  value={freightInput} onChangeText={setFreightInput}
                  placeholder="0" placeholderTextColor={INK3}
                  selectTextOnFocus />
              </View>
            </View>
          </View>
          {fobTotal > 0 && (
            <View style={styles.cifRow}>
              <Text style={styles.cifLabel}>CIF value</Text>
              <View style={styles.cifValues}>
                <Text style={styles.cifKHR}>{fmtKHR(fobTotal * config.khrRate)}</Text>
                <Text style={styles.cifUSD}>{fmtUSD(fobTotal)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Car type label ── */}
        <Text style={styles.sectionLabel}>Select car type</Text>

        {/* ── Car type grid ── */}
        <View style={styles.grid}>
          {config.carTypes.map(type => (
            <CarTypeCard
              key={type.id}
              type={type}
              selected={selectedId === type.id}
              onPress={() => setSelectedId(type.id)}
              fobUSD={fobTotal}
              khrRate={config.khrRate}
              vat={config.vat}
              vvf={config.vvfFee}
            />
          ))}
        </View>

        {/* ── Rate summary for selected type ── */}
        {(() => {
          const sel = config.carTypes.find(t => t.id === selectedId);
          if (!sel) return null;
          return (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {sel.icon}  {sel.name} — full rate breakdown
              </Text>
              {/* COP */}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>COP  Customs duty</Text>
                <View style={styles.summaryValCol}>
                  <Text style={styles.summaryVal}>{pct(sel.customsDuty)} of CIF</Text>
                  {fobTotal > 0 && (
                    <Text style={styles.summaryUSD}>
                      ≈ {fmtUSD((fobTotal * config.khrRate * sel.customsDuty) / config.khrRate)}
                    </Text>
                  )}
                </View>
              </View>
              {/* SOP rows */}
              {sel.engineBased ? (
                Object.entries(sel.specialRates).map(([eng, rate]) => {
                  const label = eng === '1500' ? '≤ 1,500 cc'
                    : eng === '2000' ? '1,501–2,000 cc'
                    : eng === '3000' ? '2,001–3,000 cc' : '> 3,000 cc';
                  const cifKHR = fobTotal * config.khrRate;
                  const copKHR = cifKHR * sel.customsDuty;
                  const sopUSD = fobTotal > 0 ? ((cifKHR + copKHR) * (rate as number)) / config.khrRate : 0;
                  return (
                    <View style={styles.summaryRow} key={eng}>
                      <Text style={styles.summaryKey}>SOP  {label}</Text>
                      <View style={styles.summaryValCol}>
                        <Text style={styles.summaryVal}>{pct(rate as number)} of (CIF+COP)</Text>
                        {fobTotal > 0 && <Text style={styles.summaryUSD}>≈ {fmtUSD(sopUSD)}</Text>}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>SOP  Special tax</Text>
                  <View style={styles.summaryValCol}>
                    <Text style={styles.summaryVal}>{pct(Object.values(sel.specialRates)[0])} flat</Text>
                    {fobTotal > 0 && (() => {
                      const cifKHR = fobTotal * config.khrRate;
                      const copKHR = cifKHR * sel.customsDuty;
                      const sopUSD = ((cifKHR + copKHR) * Object.values(sel.specialRates)[0]) / config.khrRate;
                      return <Text style={styles.summaryUSD}>≈ {fmtUSD(sopUSD)}</Text>;
                    })()}
                  </View>
                </View>
              )}
              {/* VOP */}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>VOP  VAT</Text>
                <View style={styles.summaryValCol}>
                  <Text style={styles.summaryVal}>{pct(config.vat)} of (CIF+COP+SOP)</Text>
                </View>
              </View>
              {/* VVF */}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>VVF  Vignette fee</Text>
                <View style={styles.summaryValCol}>
                  <Text style={styles.summaryVal}>{fmtKHR(config.vvfFee)}</Text>
                  <Text style={styles.summaryUSD}>{fmtUSD(config.vvfFee / config.khrRate)}</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* ── Next button ── */}
        <TouchableOpacity style={styles.nextBtn} onPress={() => onNext(selectedId)} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>Calculate tax  →</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Estimates use midpoint SOP rate. Use Screen 2 for exact calculation by engine size.
          {'\n'}{config.ratesLabel} · April 2026 EV/HEV/PHEV reductions included.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: CREAM },
  scroll:    { flex: 1 },
  container: { padding: 16, paddingBottom: 48 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    backgroundColor: WHITE, borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  appTag:        { fontSize: 12, fontWeight: '600', color: ACCENT, letterSpacing: 1, marginBottom: 2 },
  appTitle:      { fontSize: 22, fontWeight: '700', color: INK, letterSpacing: -0.5 },
  appSub:        { fontSize: 11, color: INK3, marginTop: 2 },
  manageBtn:     { backgroundColor: CREAM, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 0.5, borderColor: BORDER, marginTop: 4 },
  manageBtnText: { fontSize: 12, fontWeight: '600', color: INK2 },

  // KHR card
  khrCard:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: WHITE, borderRadius: 14, padding: 16, marginTop: 16, marginBottom: 10, borderWidth: 0.5, borderColor: BORDER },
  khrLeft:      { flex: 1 },
  khrLabel:     { fontSize: 11, fontWeight: '600', color: INK3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  khrNote:      { fontSize: 14, color: INK2 },
  khrRight:     { alignItems: 'flex-end' },
  khrDisplay:   { alignItems: 'flex-end' },
  khrValue:     { fontSize: 22, fontWeight: '700', color: ACCENT },
  khrEditHint:  { fontSize: 11, color: INK3, marginTop: 2 },
  khrEditRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  khrInput:     { fontSize: 20, fontWeight: '700', color: ACCENT, textAlign: 'right', minWidth: 80, borderBottomWidth: 2, borderBottomColor: ACCENT, padding: 0, paddingBottom: 2 },
  khrUnit:      { fontSize: 13, color: INK3, fontWeight: '500' },
  khrSaveBtn:   { backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  khrSaveBtnText:{ fontSize: 13, fontWeight: '700', color: WHITE },

  // Price card
  priceCard:    { backgroundColor: WHITE, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: BORDER },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: INK3, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 12 },
  inputRow:     { flexDirection: 'row', gap: 10 },
  inputGroup:   { flex: 1 },
  inputLabel:   { fontSize: 12, color: INK3, marginBottom: 6 },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: CREAM, borderRadius: 10, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 10, height: 44 },
  inputPrefix:  { fontSize: 15, color: INK2, marginRight: 4 },
  input:        { flex: 1, fontSize: 15, fontWeight: '600', color: INK, padding: 0 },
  cifRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: BORDER },
  cifLabel:     { fontSize: 12, color: INK3 },
  cifValues:    { alignItems: 'flex-end' },
  cifKHR:       { fontSize: 14, fontWeight: '700', color: INK },
  cifUSD:       { fontSize: 12, color: INK3, marginTop: 2 },

  // Car type grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },

  card: {
    width: '47.5%', backgroundColor: WHITE,
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 14, position: 'relative',
  },
  cardSelected: { backgroundColor: ACCENT, borderColor: ACCENT },
  cardGreen:    { backgroundColor: EV_BG, borderColor: '#A8D5B5' },

  checkmark:     { position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  checkmarkText: { fontSize: 11, color: WHITE, fontWeight: '700' },

  cardIcon:   { fontSize: 26, marginBottom: 6 },
  cardName:   { fontSize: 13, fontWeight: '700', color: INK, marginBottom: 2 },
  cardNameKh: { fontSize: 11, color: INK3, marginBottom: 8 },

  // Rate pills
  pillRow:   { flexDirection: 'row', gap: 4, marginBottom: 10, flexWrap: 'wrap' },
  pill:      { backgroundColor: CREAM, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 0.5, borderColor: BORDER, alignItems: 'center' },
  pillSelected:{ backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'transparent' },
  pillLabel: { fontSize: 9, color: INK3, fontWeight: '600' },
  pillValue: { fontSize: 11, color: INK, fontWeight: '700' },

  // Estimate box
  estimateBox:         { backgroundColor: CREAM, borderRadius: 8, padding: 8, marginTop: 4 },
  estimateBoxSelected: { backgroundColor: 'rgba(0,0,0,0.15)' },
  estimateLabel:       { fontSize: 9, color: INK3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  estimateKHR:         { fontSize: 13, fontWeight: '700', color: INK },
  estimateUSD:         { fontSize: 11, color: INK2, marginTop: 1 },
  estimateLanded:      { fontSize: 10, color: INK3, marginTop: 3 },
  estimatePlaceholder: { fontSize: 10, color: INK3, marginTop: 8, fontStyle: 'italic' },

  cardNote: { fontSize: 10, color: EV_TX, fontWeight: '500', marginTop: 6 },

  // Summary card
  summaryCard:   { backgroundColor: WHITE, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: BORDER },
  summaryTitle:  { fontSize: 13, fontWeight: '700', color: INK, marginBottom: 12 },
  summaryRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  summaryKey:    { fontSize: 12, color: INK2, flex: 1 },
  summaryValCol: { alignItems: 'flex-end' },
  summaryVal:    { fontSize: 12, fontWeight: '600', color: ACCENT },
  summaryUSD:    { fontSize: 11, color: INK3, marginTop: 2 },

  // Next button
  nextBtn:     { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginBottom: 16 },
  nextBtnText: { fontSize: 17, fontWeight: '700', color: WHITE, letterSpacing: 0.3 },

  disclaimer: { fontSize: 11, color: INK3, lineHeight: 17, textAlign: 'center' },

  // Shared text helpers
  whiteText: { color: WHITE },
  white60:   { color: 'rgba(255,255,255,0.6)' },
  white70:   { color: 'rgba(255,255,255,0.7)' },
});

export default CarTypeSelectScreen;
