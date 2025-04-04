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
            localStorage.removeItem('authToken'); // Clear session
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
            localStorage.setItem('authToken', token); // Store token locally
            resolve(token);
        });
    });

    /* User Authentication Functions */

    const register = (email, password, onSuccess, onFailure) => {
        const attributeEmail = new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'email',
            Value: email
        });

        userPool.signUp(toUsername(email), password, [attributeEmail], null, (err, result) => {
            err ? onFailure(err) : onSuccess(result);
        });
    };

    const signin = (email, password, onSuccess, onFailure) => {
        const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
            Username: toUsername(email),
            Password: password
        });

        const cognitoUser = createCognitoUser(email);
        cognitoUser.authenticateUser(authDetails, {
            onSuccess,
            onFailure
        });
    };

    const verify = (email, code, onSuccess, onFailure) => {
        createCognitoUser(email).confirmRegistration(code, true, (err, result) => {
            err ? onFailure(err) : onSuccess(result);
        });
    };

    const createCognitoUser = (email) => new AmazonCognitoIdentity.CognitoUser({
        Username: toUsername(email),
        Pool: userPool
    });

    const toUsername = (email) => email.replace('@', '-at-');

    /* Event Handlers */

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
                console.log('Successfully Logged In');
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
                console.log('User registered:', result.user.getUsername());
                alert('Registration successful. Check your email for the verification code.');
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
                alert('Verification successful. Redirecting to login page.');
                window.location.href = signinUrl;
            },
            (err) => {
                alert(`Verification failed: ${err.message || err}`);
            }
        );
    };
})(jQuery);
