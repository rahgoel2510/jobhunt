import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCB3pL0d_z-xDi2LPjlj7jLKpOXbHyG-a4",
  authDomain: "jobhaunt-tracker.firebaseapp.com",
  projectId: "jobhaunt-tracker",
  storageBucket: "jobhaunt-tracker.firebasestorage.app",
  messagingSenderId: "146892256588",
  appId: "1:146892256588:web:85c6b0795174d18068cbe9"
}

const app = initializeApp(firebaseConfig)
export const firedb = getFirestore(app)
