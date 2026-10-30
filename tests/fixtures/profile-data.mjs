export const auth = { currentUser: { uid: 'test-collector', email: 'fixture@example.test', getIdTokenResult: async () => ({ claims: {} }) } }
export const db = {}
export const doc = () => ({})
export const getDoc = async () => ({ exists: () => true, data: () => ({ displayName: 'Test collector', location: 'Copenhagen', bio: 'Synthetic profile for checking visibility controls.' }) })
export const getPublicProfile = async () => null
export const listListings = async () => []
export const watchTrades = success => { success([]); return () => {} }
export const signOut = async () => {}
export const saveProfileDetails = async () => {}
