export const INITIAL_DATA = {
  company: { name: "My Enterprise", mobile: "", address: "", financialYear: "2024-25", currency: "₹" },
  parties: [],
  items: [],
  staff: [],
  attendance: [],
  transactions: [],
  tasks: [],
  assets: [],
  workLogs: [],
  personalTasks: [],
  personalTransactions: [],
  personalAccounts: [],
  personalCategories: {
    income: ['Salary', 'Gift'],
    expense: ['Food', 'Rent', 'Travel'],
    sub: {}
  },
  categories: {
    expense: ["Rent", "Electricity", "Marketing", "Salary"],
    item: ["Electronics", "Grocery", "General", "Furniture", "Pharmacy"],
    taskStatus: ["To Do", "In Progress", "Done"],
    amc: ["General", "Premium", "Comprehensive"],
    sub: {}
  },
  counters: { 
      sales: 921, 
      purchase: 228, 
      expense: 910, 
      payment: 1663,
      task: 508,
      party: 658, 
      item: 1184, 
      staff: 103, 
      estimate: 100,
      transaction: 1000
  },
  counters_26_27: {
      sales: 1, 
      purchase: 1, 
      expense: 1, 
      payment: 1,
      estimate: 1
  }
};
