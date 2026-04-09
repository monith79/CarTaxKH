/**
 * CarTypeSelectScreen.tsx
 * First screen — select car type + set exchange rate → go to calculator.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTaxConfig } from './useTaxConfig';
import { CarTypeConfig } from './taxConfig';

// ─── Design tokens ────────────────────────────────────────────────────────────
const CREAM  = '#F7F6F2';
const INK    = '#1A1A18';
const INK2   = '#5C5C58';
const INK3   = '#9B9B96';
const BORDER = '#E2E0D8';
const ACCENT = '#1A4731';
const WHITE  = '#FFFFFF';
const EV_BG  = '#E6F7EF';
const EV_TX  = '#0B5C34';

const pct = (r: number) => `${Math.round(r * 100)}%`;

// ─── Car type card ────────────────────────────────────────────────────────────
const CarTypeCard = ({
  type, selected, onPress,
}: { type: CarTypeConfig; selected: boolean; onPress: () => void }) => {
  const isGreen = type.id === 'ev' || type.id === 'phev' || type.id === 'hybrid';
  const rates   = type.engineBased
    ? `SOP ${pct(Math.min(...Object.values(type.specialRates)))}–${pct(Math.max(...Object.values(type.specialRates)))}`
    : `SOP ${pct(Object.values(type.specialRates)[0])} flat`;

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
      {/* Selected checkmark */}
      {selected && (
        <View style={styles.checkmark}><Text style={styles.checkmarkText}>✓</Text></View>
      )}

      <Text style={styles.cardIcon}>{type.icon}</Text>
      <Text style={[styles.cardName, selected && styles.cardNameSelected]}>{type.name}</Text>
      <Text style={[styles.cardNameKh, selected && styles.cardNameKhSelected]}>{type.nameKh}</Text>
      <Text style={[styles.cardDesc, selected && styles.cardDescSelected]}>{type.description}</Text>

      <View style={styles.cardRates}>
        <View style={[styles.ratePill, selected && styles.ratePillSelected]}>
          <Text style={[styles.ratePillText, selected && styles.ratePillTextSelected]}>
            COP {pct(type.customsDuty)}
          </Text>
        </View>
        <View style={[styles.ratePill, selected && styles.ratePillSelected]}>
          <Text style={[styles.ratePillText, selected && styles.ratePillTextSelected]}>
            {rates}
          </Text>
        </View>
      </View>

      {type.note && (
        <Text style={[styles.cardNote, selected && styles.cardNoteSelected]}>
          {type.note}
        </Text>
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
  const [selectedId, setSelectedId]   = useState<string>('petrol');
  const [khrInput,   setKhrInput]     = useState(config.khrRate.toString());
  const [khrEditing, setKhrEditing]   = useState(false);

  // Save KHR rate when user finishes editing
  const handleKhrSave = useCallback(async () => {
    const val = parseFloat(khrInput) || config.khrRate;
    if (val < 100) { Alert.alert('Invalid rate', 'Exchange rate must be at least 100.'); return; }
    setKhrInput(val.toString());
    setKhrEditing(false);
    await saveConfig({ ...config, khrRate: val });
  }, [khrInput, config, saveConfig]);

  const handleNext = useCallback(() => {
    onNext(selectedId);
  }, [selectedId, onNext]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={CREAM} />

      {/* ── Header ── */}
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
      >
        {/* ── Exchange rate (user-editable) ── */}
        <View style={styles.khrCard}>
          <View style={styles.khrLeft}>
            <Text style={styles.khrLabel}>Exchange rate</Text>
            <Text style={styles.khrNote}>$1 USD =</Text>
          </View>
          <View style={styles.khrRight}>
            {khrEditing ? (
              <View style={styles.khrEditRow}>
                <TextInput
                  style={styles.khrInput}
                  value={khrInput}
                  onChangeText={setKhrInput}
                  keyboardType="numeric"
                  autoFocus
                  selectTextOnFocus
                  onBlur={handleKhrSave}
                  onSubmitEditing={handleKhrSave}
                />
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
            />
          ))}
        </View>

        {/* ── Selected summary ── */}
        {(() => {
          const selected = config.carTypes.find(t => t.id === selectedId);
          if (!selected) return null;
          return (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {selected.icon}  {selected.name} — tax summary
              </Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>COP Customs duty</Text>
                <Text style={styles.summaryVal}>{pct(selected.customsDuty)} of CIF</Text>
              </View>
              {selected.engineBased ? (
                Object.entries(selected.specialRates).map(([eng, rate]) => {
                  const label = eng === '1500' ? '≤ 1,500 cc'
                    : eng === '2000' ? '1,501–2,000 cc'
                    : eng === '3000' ? '2,001–3,000 cc'
                    : '> 3,000 cc';
                  return (
                    <View style={styles.summaryRow} key={eng}>
                      <Text style={styles.summaryKey}>SOP  {label}</Text>
                      <Text style={styles.summaryVal}>{pct(rate)} of (CIF+COP)</Text>
                    </View>
                  );
                })
              ) : (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryKey}>SOP Special tax</Text>
                  <Text style={styles.summaryVal}>{pct(Object.values(selected.specialRates)[0])} flat</Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>VOP VAT</Text>
                <Text style={styles.summaryVal}>{pct(config.vat)} of (CIF+COP+SOP)</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryKey}>VVF Vignette fee</Text>
                <Text style={styles.summaryVal}>៛{config.vvfFee.toLocaleString()} flat</Text>
              </View>
            </View>
          );
        })()}

        {/* ── Next button ── */}
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>Calculate tax  →</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Rates: {config.ratesLabel}. Includes April 2026 EV/HEV/PHEV incentive reductions.
          Always confirm with a licensed customs broker.
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

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    backgroundColor: WHITE, borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  appTag:   { fontSize: 12, fontWeight: '600', color: ACCENT, letterSpacing: 1, marginBottom: 2 },
  appTitle: { fontSize: 22, fontWeight: '700', color: INK, letterSpacing: -0.5 },
  appSub:   { fontSize: 11, color: INK3, marginTop: 2 },
  manageBtn:     { backgroundColor: CREAM, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 0.5, borderColor: BORDER, marginTop: 4 },
  manageBtnText: { fontSize: 12, fontWeight: '600', color: INK2 },

  // KHR rate card
  khrCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: WHITE, borderRadius: 14, padding: 16,
    marginTop: 16, marginBottom: 20,
    borderWidth: 0.5, borderColor: BORDER,
  },
  khrLeft:    { flex: 1 },
  khrLabel:   { fontSize: 11, fontWeight: '600', color: INK3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  khrNote:    { fontSize: 14, color: INK2 },
  khrRight:   { alignItems: 'flex-end' },
  khrDisplay: { alignItems: 'flex-end' },
  khrValue:   { fontSize: 22, fontWeight: '700', color: ACCENT },
  khrEditHint:{ fontSize: 11, color: INK3, marginTop: 2 },
  khrEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  khrInput:   { fontSize: 20, fontWeight: '700', color: ACCENT, textAlign: 'right', minWidth: 80, borderBottomWidth: 2, borderBottomColor: ACCENT, padding: 0, paddingBottom: 2 },
  khrUnit:    { fontSize: 13, color: INK3, fontWeight: '500' },
  khrSaveBtn: { backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  khrSaveBtnText: { fontSize: 13, fontWeight: '700', color: WHITE },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: INK3, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 12 },

  // Car type grid — 2 columns
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },

  card: {
    width: '47.5%',
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    position: 'relative',
  },
  cardSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  cardGreen: {
    backgroundColor: EV_BG,
    borderColor: '#A8D5B5',
  },

  checkmark: {
    position: 'absolute', top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkmarkText: { fontSize: 11, color: WHITE, fontWeight: '700' },

  cardIcon:   { fontSize: 28, marginBottom: 8 },
  cardName:   { fontSize: 14, fontWeight: '700', color: INK, marginBottom: 2 },
  cardNameSelected: { color: WHITE },
  cardNameKh: { fontSize: 11, color: INK3, marginBottom: 4 },
  cardNameKhSelected: { color: 'rgba(255,255,255,0.65)' },
  cardDesc:   { fontSize: 11, color: INK2, marginBottom: 10 },
  cardDescSelected: { color: 'rgba(255,255,255,0.7)' },

  cardRates: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  ratePill:  { backgroundColor: CREAM, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 0.5, borderColor: BORDER },
  ratePillSelected: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'transparent' },
  ratePillText: { fontSize: 10, fontWeight: '600', color: INK2 },
  ratePillTextSelected: { color: WHITE },

  cardNote: { fontSize: 10, color: EV_TX, fontWeight: '500', marginTop: 2 },
  cardNoteSelected: { color: 'rgba(255,255,255,0.75)' },

  // Summary card
  summaryCard: {
    backgroundColor: WHITE, borderRadius: 14, padding: 16,
    marginBottom: 16, borderWidth: 0.5, borderColor: BORDER,
  },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: INK, marginBottom: 12 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  summaryKey:   { fontSize: 12, color: INK2 },
  summaryVal:   { fontSize: 12, fontWeight: '600', color: ACCENT },

  // Next button
  nextBtn: {
    backgroundColor: ACCENT, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center', marginBottom: 16,
  },
  nextBtnText: { fontSize: 17, fontWeight: '700', color: WHITE, letterSpacing: 0.3 },

  disclaimer: { fontSize: 11, color: INK3, lineHeight: 17, textAlign: 'center' },
});

export default CarTypeSelectScreen;
