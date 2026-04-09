/**
 * useTaxConfig.ts
 * Shared hook — reads & writes all car type rates from AsyncStorage.
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  KHR_RATE, VAT_RATE, VVF_FEE, RATES_LABEL,
  CAR_TYPES, CarTypeConfig, CONFIG_KEY,
} from './taxConfig';

export interface TaxConfigStore {
  khrRate:    number;
  vat:        number;
  vvfFee:     number;
  ratesLabel: string;
  lastUpdated: string;
  carTypes:   CarTypeConfig[];  // all car types with editable rates
}

export const buildDefaultConfig = (): TaxConfigStore => ({
  khrRate:    KHR_RATE,
  vat:        VAT_RATE,
  vvfFee:     VVF_FEE,
  ratesLabel: RATES_LABEL,
  lastUpdated: '',
  carTypes:   JSON.parse(JSON.stringify(CAR_TYPES)), // deep copy
});

export function useTaxConfig() {
  const [config,  setConfig]  = useState<TaxConfigStore>(buildDefaultConfig());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(CONFIG_KEY).then(raw => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as TaxConfigStore;
          // Merge saved with defaults to ensure new car types appear
          const merged = buildDefaultConfig();
          merged.khrRate    = saved.khrRate    ?? merged.khrRate;
          merged.vat        = saved.vat        ?? merged.vat;
          merged.vvfFee     = saved.vvfFee     ?? merged.vvfFee;
          merged.ratesLabel = saved.ratesLabel ?? merged.ratesLabel;
          merged.lastUpdated = saved.lastUpdated ?? '';
          // Merge car type rates (saved overrides defaults per id)
          if (saved.carTypes) {
            merged.carTypes = merged.carTypes.map(def => {
              const savedType = saved.carTypes.find(c => c.id === def.id);
              if (!savedType) return def;
              return {
                ...def,
                customsDuty:  savedType.customsDuty  ?? def.customsDuty,
                specialRates: savedType.specialRates ?? def.specialRates,
              };
            });
          }
          setConfig(merged);
        } catch (_) {}
      }
      setLoading(false);
    });
  }, []);

  const saveConfig = useCallback(async (updated: TaxConfigStore) => {
    const withDate = { ...updated, lastUpdated: new Date().toISOString() };
    setConfig(withDate);
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(withDate));
  }, []);

  const resetConfig = useCallback(async () => {
    const reset = { ...buildDefaultConfig(), lastUpdated: new Date().toISOString() };
    setConfig(reset);
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(reset));
  }, []);

  const getCarType = useCallback((id: string) =>
    config.carTypes.find(c => c.id === id) ?? config.carTypes[0],
  [config]);

  return { config, loading, saveConfig, resetConfig, getCarType };
}
