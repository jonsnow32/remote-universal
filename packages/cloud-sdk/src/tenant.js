export const TenantService = {
    async getTenantConfig(tenantId) {
        try {
            const response = await fetch(`/api/tenants/${tenantId}`);
            if (!response.ok)
                return null;
            return response.json();
        }
        catch {
            return null;
        }
    },
};
//# sourceMappingURL=tenant.js.map