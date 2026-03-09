export interface TenantConfig {
  id: string;
  brandId: string;
  name: string;
  features: Record<string, boolean>;
  theme: Record<string, unknown>;
}

export const TenantService = {
  async getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
    try {
      const response = await fetch(`/api/tenants/${tenantId}`);
      if (!response.ok) return null;
      return response.json() as Promise<TenantConfig>;
    } catch {
      return null;
    }
  },
};
