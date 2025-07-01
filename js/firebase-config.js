// Firebase configuration
// Replace with your actual Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAG7iyDcdPWFK21tg0cxGDOvNAt8aD0Jog",
    authDomain: "budget-tracker-bf232.firebaseapp.com",
    databaseURL: "https://budget-tracker-bf232-default-rtdb.firebaseio.com",
    projectId: "budget-tracker-bf232",
    storageBucket: "budget-tracker-bf232.firebasestorage.app",
    messagingSenderId: "369163526936",
    appId: "1:369163526936:web:d0b0e2a5366c5900a6746d",
    measurementId: "G-4PRLS0R966"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const database = firebase.database();

// Export for use in other files
window.auth = auth;
window.database = database;

console.log('Firebase initialized successfully');

