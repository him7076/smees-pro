export const companyManager = {
    getCompanies: () => {
        const saved = localStorage.getItem('smees_companies');
        return saved ? JSON.parse(saved) : [{ id: 'default', name: 'Main Company' }];
    },
    
    getActiveId: () => {
        return localStorage.getItem('smees_active_comp') || 'default';
    },

    setActiveId: (id) => {
        localStorage.setItem('smees_active_comp', id);
        window.location.reload();
    },

    addCompany: (name) => {
        const companies = companyManager.getCompanies();
        const newId = `comp_${Date.now()}`;
        const newCompanies = [...companies, { id: newId, name }];
        localStorage.setItem('smees_companies', JSON.stringify(newCompanies));
        companyManager.setActiveId(newId);
        return newId;
    }
};
