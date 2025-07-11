// Passcode logic for Sub-Admin
// Requires Firebase Auth and Database to be loaded

(function() {
    // Firebase references
    let currentUser = null;
    let userPasscodeRef = null;
    let passcodeExists = false;
    let passcodeVerified = false;

    // DOM elements
    const passcodeModal = document.getElementById('passcodeModal');
    const passcodeForm = document.getElementById('passcodeForm');
    const passcodeInput = document.getElementById('passcodeInput');
    const passcodeError = document.getElementById('passcodeError');
    const passcodeModalTitle = document.getElementById('passcodeModalTitle');
    const passcodeActions = document.getElementById('passcodeActions');
    const changePasscodeBtn = document.getElementById('changePasscodeBtn');
    const deletePasscodeBtn = document.getElementById('deletePasscodeBtn');
    const closePasscodeModal = document.getElementById('closePasscodeModal');
    const passcodeSettingsBtn = document.getElementById('passcodeSettingsBtn');

    // Utility: Simple hash (not secure, but better than plain text)
    function hashPasscode(passcode) {
        // Simple hash for demonstration (use a better hash in production)
        let hash = 0;
        for (let i = 0; i < passcode.length; i++) {
            hash = ((hash << 5) - hash) + passcode.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString();
    }

    // Show/hide modal
    function showPasscodeModal(mode = 'verify') {
        passcodeInput.value = '';
        passcodeError.classList.add('hidden');
        passcodeForm.reset();
        passcodeModal.classList.remove('hidden');
        if (mode === 'verify') {
            passcodeModalTitle.textContent = 'Enter Passcode';
            passcodeActions.classList.add('hidden');
            closePasscodeModal.style.display = 'none'; // Hide close button in verify mode
            passcodeForm.setAttribute('data-mode', 'verify');
        } else if (mode === 'set') {
            passcodeModalTitle.textContent = 'Set Passcode';
            passcodeActions.classList.add('hidden');
            closePasscodeModal.style.display = '';
            passcodeForm.setAttribute('data-mode', 'set');
        } else if (mode === 'change') {
            passcodeModalTitle.textContent = 'Enter Old Passcode';
            passcodeActions.classList.add('hidden');
            closePasscodeModal.style.display = '';
            passcodeForm.setAttribute('data-mode', 'change-old');
        } else if (mode === 'change-new') {
            passcodeModalTitle.textContent = 'Set New Passcode';
            passcodeActions.classList.add('hidden');
            closePasscodeModal.style.display = '';
            passcodeForm.setAttribute('data-mode', 'change-new');
        } else if (mode === 'delete') {
            passcodeModalTitle.textContent = 'Enter Old Passcode';
            passcodeActions.classList.add('hidden');
            closePasscodeModal.style.display = '';
            passcodeForm.setAttribute('data-mode', 'delete');
        } else if (mode === 'settings') {
            passcodeModalTitle.textContent = 'Passcode Options';
            passcodeActions.classList.remove('hidden');
            passcodeForm.classList.add('hidden');
        }
        if (mode !== 'settings') {
            passcodeForm.classList.remove('hidden');
        }
        document.body.style.overflow = 'hidden';
    }
    function hidePasscodeModal() {
        passcodeModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    // Check if passcode is set for user
    function checkPasscode() {
        if (!currentUser) return;
        userPasscodeRef = firebase.database().ref('users/' + currentUser.uid + '/passcode');
        userPasscodeRef.once('value').then(snapshot => {
            passcodeExists = !!snapshot.val();
            if (passcodeExists) {
                // Require passcode on app open
                showPasscodeModal('verify');
            }
        });
    }

    // Verify passcode
    function verifyPasscode(input) {
        userPasscodeRef.once('value').then(snapshot => {
            const storedHash = snapshot.val();
            if (storedHash && hashPasscode(input) === storedHash) {
                passcodeVerified = true;
                hidePasscodeModal();
            } else {
                passcodeError.textContent = 'Incorrect passcode';
                passcodeError.classList.remove('hidden');
            }
        });
    }

    // Set new passcode
    function setPasscode(newPasscode) {
        userPasscodeRef.set(hashPasscode(newPasscode)).then(() => {
            passcodeExists = true;
            hidePasscodeModal();
            alert('Passcode set successfully!');
        });
    }

    // Change passcode
    function changePasscode(newPasscode) {
        setPasscode(newPasscode);
    }

    // Delete passcode
    function deletePasscode() {
        userPasscodeRef.remove().then(() => {
            passcodeExists = false;
            hidePasscodeModal();
            alert('Passcode deleted.');
        });
    }

    // Handle passcode form submit
    passcodeForm && passcodeForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const value = passcodeInput.value.trim();
        if (!/^\d{4}$/.test(value)) {
            passcodeError.textContent = 'Enter a valid 4-digit passcode';
            passcodeError.classList.remove('hidden');
            return;
        }
        const mode = passcodeForm.getAttribute('data-mode');
        if (mode === 'set') {
            setPasscode(value);
        } else if (mode === 'verify') {
            verifyPasscode(value);
        } else if (mode === 'change-old') {
            // Check old passcode, then show new passcode form
            userPasscodeRef.once('value').then(snapshot => {
                const storedHash = snapshot.val();
                if (storedHash && hashPasscode(value) === storedHash) {
                    showPasscodeModal('change-new');
                } else {
                    passcodeError.textContent = 'Incorrect old passcode';
                    passcodeError.classList.remove('hidden');
                }
            });
        } else if (mode === 'change-new') {
            setPasscode(value);
        } else if (mode === 'delete') {
            // Check old passcode, then delete
            userPasscodeRef.once('value').then(snapshot => {
                const storedHash = snapshot.val();
                if (storedHash && hashPasscode(value) === storedHash) {
                    deletePasscode();
                } else {
                    passcodeError.textContent = 'Incorrect old passcode';
                    passcodeError.classList.remove('hidden');
                }
            });
        }
    });

    // Open passcode settings from Settings section
    passcodeSettingsBtn && passcodeSettingsBtn.addEventListener('click', function() {
        if (!passcodeExists) {
            showPasscodeModal('set');
        } else {
            showPasscodeModal('settings');
        }
    });

    // Change passcode
    changePasscodeBtn && changePasscodeBtn.addEventListener('click', function() {
        showPasscodeModal('change');
    });

    // Delete passcode
    deletePasscodeBtn && deletePasscodeBtn.addEventListener('click', function() {
        showPasscodeModal('delete');
    });

    // Close modal
    closePasscodeModal && closePasscodeModal.addEventListener('click', function() {
        // Only allow closing if not in verify mode
        if (passcodeModalTitle.textContent !== 'Enter Passcode') {
            hidePasscodeModal();
        }
    });

    // Hide modal on outside click
    passcodeModal && passcodeModal.addEventListener('click', function(e) {
        // Only allow closing if not in verify mode
        if (e.target === passcodeModal && passcodeModalTitle.textContent !== 'Enter Passcode') hidePasscodeModal();
    });

    // Firebase Auth state observer
    firebase.auth().onAuthStateChanged(function(user) {
        currentUser = user;
        if (user) {
            checkPasscode();
        }
    });

    // On every app open, block access until passcode is verified (if set)
    document.addEventListener('DOMContentLoaded', function() {
        firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
                userPasscodeRef = firebase.database().ref('users/' + user.uid + '/passcode');
                userPasscodeRef.once('value').then(snapshot => {
                    passcodeExists = !!snapshot.val();
                    if (passcodeExists && !passcodeVerified) {
                        showPasscodeModal('verify');
                    }
                });
            }
        });
    });
})(); 