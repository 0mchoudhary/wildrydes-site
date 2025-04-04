/*global WildRydes _config AmazonCognitoIdentity*/

const WildRydes = window.WildRydes || {};

(($) => {
    const signinUrl = '/signin.html';

    const poolData = {
        UserPoolId: _config.cognito.userPoolId,
        ClientId: _config.cognito.userPoolClientId
    };

    if (!poolData.UserPoolId || !poolData.ClientId || !_config.cognito.region) {
        $('#noCognitoMessage').show();
        return;
    }

    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

    WildRydes.signOut = () => {
        const cognitoUser = userPool.getCurrentUser();
        if (cognitoUser) {
            cognitoUser.signOut();
            localStorage.removeItem('authToken');
            console.log('User signed out.');
        }
    };

    WildRydes.authToken = new Promise((resolve, reject) => {
        const cognitoUser = userPool.getCurrentUser();
        if (!cognitoUser) return resolve(null);

        cognitoUser.getSession((err, session) => {
            if (err) return reject(err);
            if (!session.isValid()) return resolve(null);

            const token = session.getIdToken().getJwtToken();
            localStorage.setItem('authToken', token);
            resolve(token);
        });
    });

    /* Helper to compute SecretHash */
    const computeSecretHash = async (username) => {
        const clientId = _config.cognito.userPoolClientId;
        const clientSecret = _config.cognito.clientSecret;
        const msg = username + clientId;
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            "raw", encoder.encode(clientSecret),
            { name: "HMAC", hash: "SHA-256" },
            false, ["sign"]
        );
        const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(msg));
        return btoa(String.fromCharCode(...new Uint8Array(signature)));
    };

    /* User Actions */
    const register = async (email, password, onSuccess, onFailure) => {
        try {
            const attributeEmail = new AmazonCognitoIdentity.CognitoUserAttribute({
                Name: 'email',
                Value: email
            });

            const secretHash = await computeSecretHash(toUsername(email));
            userPool.signUp(
                toUsername(email),
                password,
                [attributeEmail],
                { SecretHash: secretHash },
                (err, result) => err ? onFailure(err) : onSuccess(result)
            );
        } catch (err) {
            onFailure(err);
        }
    };

    const signin = async (email, password, onSuccess, onFailure) => {
        try {
            const secretHash = await computeSecretHash(toUsername(email));

            const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
                Username: toUsername(email),
                Password: password,
                SecretHash: secretHash
            });

            const cognitoUser = createCognitoUser(email);
            cognitoUser.authenticateUser(authDetails, {
                onSuccess,
                onFailure
            });
        } catch (err) {
            onFailure(err);
        }
    };

    const verify = (email, code, onSuccess, onFailure) => {
        const cognitoUser = createCognitoUser(email);
        cognitoUser.confirmRegistration(code, true, (err, result) => {
            err ? onFailure(err) : onSuccess(result);
        });
    };

    const createCognitoUser = (email) => new AmazonCognitoIdentity.CognitoUser({
        Username: toUsername(email),
        Pool: userPool
    });

    const toUsername = (email) => email.replace('@', '-at-');

    /* Event Bindings */
    $(() => {
        $('#signinForm').submit(handleSignin);
        $('#registrationForm').submit(handleRegister);
        $('#verifyForm').submit(handleVerify);
    });

    const handleSignin = (event) => {
        event.preventDefault();
        const email = $('#emailInputSignin').val();
        const password = $('#passwordInputSignin').val();

        signin(email, password,
            () => {
                console.log('Login successful');
                window.location.href = 'ride.html';
            },
            (err) => {
                alert(`Login failed: ${err.message || err}`);
            }
        );
    };

    const handleRegister = (event) => {
        event.preventDefault();
        const email = $('#emailInputRegister').val();
        const password = $('#passwordInputRegister').val();
        const password2 = $('#password2InputRegister').val();

        if (password !== password2) {
            return alert('Passwords do not match');
        }

        register(email, password,
            (result) => {
                console.log('Registration success:', result.user.getUsername());
                alert('Registration successful! Check your email for a verification code.');
                window.location.href = 'verify.html';
            },
            (err) => {
                alert(`Registration failed: ${err.message || err}`);
            }
        );
    };

    const handleVerify = (event) => {
        event.preventDefault();
        const email = $('#emailInputVerify').val();
        const code = $('#codeInputVerify').val();

        verify(email, code,
            () => {
                alert('Verification successful! Redirecting to sign in.');
                window.location.href = signinUrl;
            },
            (err) => {
                alert(`Verification failed: ${err.message || err}`);
            }
        );
    };
})(jQuery);
