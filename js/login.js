// Login page functionality
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const loginBtn = document.getElementById("loginBtn");
    const loadingSpinner = document.getElementById("loadingSpinner");
    const errorMessage = document.getElementById("errorMessage");
    const errorText = document.getElementById("errorText");
    const togglePassword = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");
    const forgotPasswordLink = document.getElementById("forgotPassword");

    // Check if user is already logged in
    auth.onAuthStateChanged((user) => {
        if (user) {
            checkUserRoleAndRedirect(user);
        }
    });

    // Toggle password visibility
    togglePassword.addEventListener("click", () => {
        const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
        passwordInput.setAttribute("type", type);
        
        const icon = togglePassword.querySelector("i");
        if (type === "password") {
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
        } else {
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
        }
    });

    // Form validation
    function validateForm() {
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        let isValid = true;

        // Email validation
        const emailError = document.getElementById("emailError");
        if (!email) {
            showFieldError("emailError", "Email is required");
            isValid = false;
        } else if (!isValidEmail(email)) {
            showFieldError("emailError", "Please enter a valid email address");
            isValid = false;
        } else {
            hideFieldError("emailError");
        }

        // Password validation
        const passwordError = document.getElementById("passwordError");
        if (!password) {
            showFieldError("passwordError", "Password is required");
            isValid = false;
        } else if (password.length < 6) {
            showFieldError("passwordError", "Password must be at least 6 characters");
            isValid = false;
        } else {
            hideFieldError("passwordError");
        }

        return isValid;
    }

    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function showFieldError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        errorElement.textContent = message;
        errorElement.classList.remove("hidden");
    }

    function hideFieldError(elementId) {
        const errorElement = document.getElementById(elementId);
        errorElement.classList.add("hidden");
    }

    function showError(message) {
        errorText.textContent = message;
        errorMessage.classList.remove("hidden");
    }

    function hideError() {
        errorMessage.classList.add("hidden");
    }

    function showLoading() {
        loginForm.classList.add("hidden");
        loadingSpinner.classList.remove("hidden");
        hideError();
    }

    function hideLoading() {
        loginForm.classList.remove("hidden");
        loadingSpinner.classList.add("hidden");
    }

    // Login form submission
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        showLoading();

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Check user role and redirect
            await checkUserRoleAndRedirect(user);
            
        } catch (error) {
            hideLoading();
            handleAuthError(error);
        }
    });

    // Check user role and redirect
    async function checkUserRoleAndRedirect(user) {
        try {
            // Get user data from database
            const userSnapshot = await database.ref(`users/${user.uid}`).once('value');
            const userData = userSnapshot.val();
            
            if (userData) {
                const role = userData.role;
                if (role === 'admin') {
                    window.location.href = 'admin-dashboard.html';
                } else if (role === 'subadmin') {
                    window.location.href = 'sub-admin.html';
                } else {
                    throw new Error('Invalid user role');
                }
            } else {
                throw new Error('User data not found');
            }
        } catch (error) {
            hideLoading();
            showError('Error accessing user data: ' + error.message);
            await auth.signOut();
        }
    }

    // Handle authentication errors
    function handleAuthError(error) {
        let message = 'An error occurred during login';
        
        switch (error.code) {
            case 'auth/user-not-found':
                message = 'No account found with this email address';
                break;
            case 'auth/wrong-password':
                message = 'Incorrect password';
                break;
            case 'auth/invalid-email':
                message = 'Invalid email address';
                break;
            case 'auth/user-disabled':
                message = 'This account has been disabled';
                break;
            case 'auth/too-many-requests':
                message = 'Too many failed attempts. Please try again later';
                break;
            case 'auth/network-request-failed':
                message = 'Network error. Please check your connection';
                break;
            default:
                message = error.message;
        }
        
        showError(message);
    }

    // Forgot password functionality
    forgotPasswordLink.addEventListener("click", async (e) => {
        e.preventDefault();
        
        const email = document.getElementById("email").value;
        if (!email) {
            showError('Please enter your email address first');
            return;
        }
        
        if (!isValidEmail(email)) {
            showError('Please enter a valid email address');
            return;
        }

        try {
            await auth.sendPasswordResetEmail(email);
            showError('Password reset email sent! Check your inbox.');
            errorMessage.classList.remove("bg-red-100", "border-red-400", "text-red-700");
            errorMessage.classList.add("bg-green-100", "border-green-400", "text-green-700");
        } catch (error) {
            handleAuthError(error);
        }
    });

    // Real-time form validation
    document.getElementById("email").addEventListener("blur", () => {
        const email = document.getElementById("email").value;
        if (email && !isValidEmail(email)) {
            showFieldError("emailError", "Please enter a valid email address");
        } else {
            hideFieldError("emailError");
        }
    });

    document.getElementById("password").addEventListener("input", () => {
        const password = document.getElementById("password").value;
        if (password && password.length < 6) {
            showFieldError("passwordError", "Password must be at least 6 characters");
        } else {
            hideFieldError("passwordError");
        }
    });
});

