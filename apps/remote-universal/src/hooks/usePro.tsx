import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
} from 'react-native-purchases';
import { ENTITLEMENT_PRO, IS_EXPO_GO } from '../lib/purchases';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProContextValue {
  isPro: boolean;
  isLoading: boolean;
  offering: PurchasesOffering | null;
  purchase: (productIdentifier: string) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ProContext = createContext<ProContextValue>({
  isPro: false,
  isLoading: true,
  offering: null,
  purchase: async () => false,
  restore: async () => false,
  refresh: async () => {},
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function checkEntitlement(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT_PRO] !== undefined;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const listenerRef = useRef<((info: CustomerInfo) => void) | null>(null);

  const refresh = useCallback(async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setIsPro(checkEntitlement(info));
    } catch {
      // Offline or simulator — keep current state
    }
  }, []);

  useEffect(() => {
    // Expo Go: RevenueCat not initialized — use free-tier defaults
    if (IS_EXPO_GO) {
      setIsLoading(false);
      return;
    }

    // Load initial customer info + offering in parallel
    Promise.all([
      Purchases.getCustomerInfo().catch(() => null),
      Purchases.getOfferings().catch(() => null),
    ]).then(([info, offerings]) => {
      if (info) setIsPro(checkEntitlement(info));
      if (offerings?.current) setOffering(offerings.current);
      setIsLoading(false);
    });

    // Subscribe to customer info updates (e.g. after purchase on another device)
    const listener = (info: CustomerInfo) => setIsPro(checkEntitlement(info));
    listenerRef.current = listener;
    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      if (listenerRef.current) {
        Purchases.removeCustomerInfoUpdateListener(listenerRef.current);
      }
    };
  }, []);

  const purchase = useCallback(async (productIdentifier: string): Promise<boolean> => {
    try {
      if (!offering) return false;
      const pkg = offering.availablePackages.find(
        p => p.product.identifier === productIdentifier
      );
      if (!pkg) return false;
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const active = checkEntitlement(customerInfo);
      setIsPro(active);
      return active;
    } catch (e: any) {
      // PurchaseCancelledError — user backed out, not an error
      if (e?.userCancelled) return false;
      throw e;
    }
  }, [offering]);

  const restore = useCallback(async (): Promise<boolean> => {
    try {
      const info = await Purchases.restorePurchases();
      const active = checkEntitlement(info);
      setIsPro(active);
      return active;
    } catch {
      return false;
    }
  }, []);

  return (
    <ProContext.Provider value={{ isPro, isLoading, offering, purchase, restore, refresh }}>
      {children}
    </ProContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePro(): ProContextValue {
  return useContext(ProContext);
}
