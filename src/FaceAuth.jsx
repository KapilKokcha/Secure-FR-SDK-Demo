import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Button,
  TextField,
  Tooltip,
  Alert,
  AlertTitle,
  CircularProgress,
  Typography,
  Box,
} from '@mui/material';
import {
  User as UserIcon,
  KeyRound as KeyRoundIcon,
  CheckCircle,
  XCircle,
  Info as InfoIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';

// Replace with your actual CDN URLs
const SDK_URL = '/sdk/face-sdk.umd.js';

const loadSDK = () => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onload = () => {
      resolve(window.FaceSDK);
    };
    script.onerror = () => {
      console.error('Failed to load FaceSDK');
      reject(new Error('Failed to load FaceSDK'));
    };
    document.body.appendChild(script);
  });
};

const FaceAuth = () => {
  const videoRef = useRef(null);
  const identifierInputRef = useRef(null);
  const encryptedFaceInputRef = useRef(null);

  const [faceSDK, setFaceSDK] = useState(null);
  const [registrationResult, setRegistrationResult] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [encryptedFaceData, setEncryptedFaceData] = useState(null);
  const [identifiers, setIdentifiers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registrationStage, setRegistrationStage] = useState('idle');
  const [verificationStage, setVerificationStage] = useState('idle');

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const sdk = await loadSDK();
        setFaceSDK(sdk);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };
    init();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleRegister = useCallback(async () => {
    if (!faceSDK || !videoRef.current) {
      setError('SDK not loaded or video not available.');
      return;
    }
    if (identifiers.length === 0) {
      setError('Please provide at least one identifier.');
      return;
    }

    setLoading(true);
    setError(null);
    setRegistrationStage('registering');

    try {
      const result = await faceSDK.FaceSDK.registerFace(identifiers, videoRef.current);
      setRegistrationResult(JSON.stringify(result, null, 2));
      setEncryptedFaceData(result.encryptedFace);
      alert('Face registered successfully! Save your encrypted face data.');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setRegistrationStage('idle');
      setLoading(false);
    }
  }, [faceSDK, identifiers]);

  const handleVerify = useCallback(async () => {
    if (!faceSDK || !videoRef.current || !encryptedFaceData) {
      setError('SDK not loaded or missing encrypted face data.');
      return;
    }
    if (identifiers.length === 0) {
      setError('Please provide identifiers used during registration.');
      return;
    }

    setLoading(true);
    setError(null);
    setVerificationStage('verifying');

    try {
      const isMatch = await faceSDK.FaceSDK.verifyFace(encryptedFaceData, identifiers, videoRef.current);
      setVerificationResult(isMatch ? 'Face verified! You are awesome!' : 'Face not matched. Please try again.');
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setVerificationStage('idle');
      setLoading(false);
    }
  }, [faceSDK, encryptedFaceData, identifiers]);

  const handleIdentifierInputChange = (e) => {
    const value = e.target.value.trim();
    setIdentifiers(value.split(',').map((s) => s.trim()).filter(Boolean));
  };

  const startRegistration = () => {
    setRegistrationStage('input');
    setVerificationStage('idle');
    setError(null);
    setIdentifiers([]);
    setEncryptedFaceData(null);
    setRegistrationResult(null);
    setVerificationResult(null);
    identifierInputRef.current?.focus();
  };

  const startVerification = () => {
    setVerificationStage('input');
    setRegistrationStage('idle');
    setError(null);
    setIdentifiers([]);
    setEncryptedFaceData(null);
    setRegistrationResult(null);
    setVerificationResult(null);
    identifierInputRef.current?.focus();
  };

  const getVerificationResultIcon = () => {
    if (verificationResult === 'Face verified! You are awesome!') return <CheckCircle color="green" size={20} />;
    if (verificationResult === 'Face not matched. Please try again.') return <XCircle color="red" size={20} />;
    return null;
  };

  return (
    <Box p={4} maxWidth={600} mx="auto">
      <Typography variant="h4" align="center" gutterBottom>
        Face Authentication
      </Typography>

      <Box position="relative" mb={2}>
        <video ref={videoRef} autoPlay muted style={{ width: '100%', borderRadius: 8 }} />
        {loading && (
          <Box position="absolute" top={0} left={0} right={0} bottom={0} display="flex" alignItems="center" justifyContent="center" bgcolor="rgba(0,0,0,0.5)">
            <CircularProgress />
          </Box>
        )}
      </Box>

      <Box display="flex" gap={2} mb={2}>
        <Button
          variant="contained"
          color="primary"
          onClick={startRegistration}
          disabled={loading}
          startIcon={<UserIcon size={18} />}
        >
          Register Face
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={startVerification}
          disabled={loading}
          startIcon={<KeyRoundIcon size={18} />}
        >
          Verify Face
        </Button>
      </Box>

      {(registrationStage === 'input' || verificationStage === 'input') && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Box mb={2}>
            <Tooltip
              title="Enter one or more identifiers (comma-separated). This must match during verification."
              placement="top"
            >
              <TextField
                label="Identifiers"
                placeholder="e.g., username, email@example.com"
                fullWidth
                onChange={handleIdentifierInputChange}
                inputRef={identifierInputRef}
              />
            </Tooltip>
          </Box>

          {verificationStage === 'input' && (
            <Box mb={2}>
              <TextField
                label="Encrypted Face Data"
                placeholder="Paste the encrypted data"
                fullWidth
                onChange={(e) => setEncryptedFaceData(e.target.value)}
                inputRef={encryptedFaceInputRef}
              />
            </Box>
          )}

          <Button
            fullWidth
            variant="contained"
            color={registrationStage === 'input' ? 'primary' : 'success'}
            onClick={registrationStage === 'input' ? handleRegister : handleVerify}
            disabled={loading}
          >
            {loading ? (
              <CircularProgress size={24} />
            ) : registrationStage === 'input' ? 'Confirm Registration' : 'Confirm Verification'}
          </Button>
        </motion.div>
      )}

      {registrationResult && (
        <Box mt={3}>
          <Typography variant="h6">Registration Result</Typography>
          <pre>{registrationResult}</pre>
          {encryptedFaceData && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <AlertTitle>Save your Encrypted Face Data</AlertTitle>
              <Box sx={{ wordBreak: 'break-word' }}>{encryptedFaceData}</Box>
            </Alert>
          )}
        </Box>
      )}

      {verificationResult && (
        <Box mt={3}>
          <Typography variant="h6" display="flex" alignItems="center" gap={1}>
            {getVerificationResultIcon()} Verification Result
          </Typography>
          <Alert severity={verificationResult.includes('verified') ? 'success' : 'error'}>
            {verificationResult}
          </Alert>
        </Box>
      )}

      {error && (
        <Box mt={2}>
          <Alert severity="error">
            <AlertTitle>Error</AlertTitle>
            {error}
          </Alert>
        </Box>
      )}
    </Box>
  );
};

export default FaceAuth;
