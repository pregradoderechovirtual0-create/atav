import { initializeApp } from 'firebase/app'

import { getAuth } from 'firebase/auth'

import { getFirestore } from 'firebase/firestore'



const firebaseConfig = {

  apiKey: "AIzaSyABGRzmys3y7fv1wbGf_bJ_yfgjxzwTsUM",

  authDomain: "atav-48646.firebaseapp.com",

  projectId: "atav-48646",

  storageBucket: "atav-48646.firebasestorage.app",

  messagingSenderId: "367512052174",

  appId: "1:367512052174:web:575881c5b9cdf6b5748b9f",

  measurementId: "G-1KFTY8K12D"

}



export const app = initializeApp(firebaseConfig)



export const auth = getAuth(app)

export const db = getFirestore(app)

