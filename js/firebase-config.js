// Firebase configuration
// Replace with your actual Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBnzHm98CVvJJAPObGuxg2N3ynXEYJ5KkM",
  authDomain: "my-wallet-82048.firebaseapp.com",
  projectId: "my-wallet-82048",
  storageBucket: "my-wallet-82048.firebasestorage.app",
  messagingSenderId: "340468198241",
  appId: "1:340468198241:web:7440dfbf02146d1caaf320",
  measurementId: "G-QTE88N5LYG"
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

