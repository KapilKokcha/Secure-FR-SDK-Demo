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

const SDK_URL = '/sdk/face-sdk.umd.js';

const loadSDK = () => {
  return new Promise(async (resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onload = async () => {
      if (window.FaceSDK) {
        try {
          await window.FaceSDK.FaceSDK.loadModels();
          console.log("Face SDK and models loaded successfully.");
          resolve(window.FaceSDK);
        } catch (error) {
          console.error("Error loading Face SDK models:", error);
          reject(error);
        }
      } else {
        reject(new Error("FaceSDK object not found after script load."));
      }
    };
    script.onerror = () => {
      console.error('Failed to load FaceSDK script.');
      reject(new Error('Failed to load FaceSDK script.'));
    };
    document.body.appendChild(script);
  });
};

const FaceAuth = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const identifierInputRef = useRef(null);
  const encryptedFaceInputRef = useRef(null);
  const animationFrameId = useRef(null);

  const [faceSDK, setFaceSDK] = useState(null);
  const [registrationResult, setRegistrationResult] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [encryptedFaceData, setEncryptedFaceData] = useState(null);
  const [identifiersInput, setIdentifiersInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registrationStage, setRegistrationStage] = useState('idle');
  const [verificationStage, setVerificationStage] = useState('idle');
  const [copied, setCopied] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [preFilledIdentifiers, setPreFilledIdentifiers] = useState([]);
  const [preFilledEncryptedFaceData, setPreFilledEncryptedFaceData] = useState(null);

  const identifiers = identifiersInput.split(',').map((s) => s.trim()).filter(Boolean);

  const drawLandmarks = useCallback((ctx, points, videoWidth) => {
    if (!points || !ctx) return;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = 'yellow';
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;

    points.forEach(point => {
      ctx.beginPath();
      ctx.arc(videoWidth - point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    const connections = window.FaceSDK?.FaceSDK.FACE_CONNECTIONS || [];
    connections.forEach(([start, end]) => {
      ctx.beginPath();
      ctx.moveTo(videoWidth - points[start].x, points[start].y);
      ctx.lineTo(videoWidth - points[end].x, points[end].y);
      ctx.stroke();
    });
  }, []);

  const startDetectionLoop = useCallback(async (sdk) => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const detectFrame = async () => {
      try {
        if (video.readyState >= 2) {
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;

          if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
            canvas.width = videoWidth;
            canvas.height = videoHeight;
          }

          const landmarks = await sdk.FaceSDK.detectLandmarks(video);
          drawLandmarks(ctx, landmarks, videoWidth);
        }
      } catch (error) {
        console.error('Landmark detection error:', error);
      }
      animationFrameId.current = requestAnimationFrame(detectFrame);
    };

    animationFrameId.current = requestAnimationFrame(detectFrame);
  }, [drawLandmarks]);

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        const [sdk, stream] = await Promise.all([
          loadSDK(),
          navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }
          })
        ]);

        setFaceSDK(sdk);
        videoRef.current.srcObject = stream;

        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = resolve;
        });

        startDetectionLoop(sdk);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initialize();

    return () => {
      cancelAnimationFrame(animationFrameId.current);
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [startDetectionLoop]);

  const handleRegister = useCallback(async () => {
    if (!faceSDK || !videoRef.current) {
      setError('SDK not loaded or video not available.');
      return;
    }

    if (identifiers.length < 2) {
      setError('Please provide at least 2 identifiers.');
      return;
    }

    setLoading(true);
    setError(null);
    setRegistrationStage('registering');

    try {
      const result = await faceSDK.FaceSDK.registerFace(identifiers, videoRef.current);
      setRegistrationResult(JSON.stringify(result, null, 2));
      setEncryptedFaceData(result.encryptedFace);
      setPreFilledIdentifiers(identifiers);
      setPreFilledEncryptedFaceData(result.encryptedFace);
      setJustRegistered(true);
      setNotificationMessage('Face registered successfully! Save your encrypted face data.');
      setTimeout(() => setNotificationMessage(''), 5000);
    } catch (err) {
      if (err.message === "No face detected") {
        setError("Please ensure your face is clearly visible in the frame with adequate lighting.");
        setRegistrationStage('input');
        return;
      }
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
      if (err.message === "No face detected") {
        setError("Please ensure your face is clearly visible in the frame with adequate lighting.");
        setVerificationStage('input');
        return;
      }
      setError(err.message || 'Verification failed');
    } finally {
      setVerificationStage('idle');
      setLoading(false);
    }
  }, [faceSDK, encryptedFaceData, identifiers]);

  const handleCopy = () => {
    navigator.clipboard.writeText(encryptedFaceData).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleIdentifierInputChange = (e) => {
    setIdentifiersInput(e.target.value);
  };

  const startRegistration = () => {
    setRegistrationStage('input');
    setVerificationStage('idle');
    setError(null);
    setIdentifiersInput('');
    setEncryptedFaceData(null);
    setRegistrationResult(null);
    setVerificationResult(null);
    identifierInputRef.current?.focus();
  };

  const startVerification = () => {
    setVerificationStage('input');
    setRegistrationStage('idle');
    setError(null);
    setRegistrationResult(null); // Clear registration result
    setVerificationResult(null);

    if (justRegistered) {
      setIdentifiersInput(preFilledIdentifiers.join(', '));
      setEncryptedFaceData(preFilledEncryptedFaceData);
      setNotificationMessage("We've pre-filled your details from the recent registration.");
      setTimeout(() => setNotificationMessage(''), 5000);
    } else {
      setIdentifiersInput('');
      setEncryptedFaceData(null);
      setVerificationResult(null);
    }

    setJustRegistered(false);
    identifierInputRef.current?.focus();
  };
  const getVerificationResultIcon = () => {
    if (verificationResult?.includes('verified')) return <CheckCircle color="green" size={20} />;
    if (verificationResult?.includes('not matched')) return <XCircle color="red" size={20} />;
    return null;
  };

  return (
    <Box p={4} maxWidth={600} mx="auto">
      <Typography variant="h4" align="center" gutterBottom>
        Face Authentication
      </Typography>

      <Box position="relative" mb={2}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: '100%',
            borderRadius: 8,
            transform: 'scaleX(-1)',
            backgroundColor: '#000',
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />

        {loading && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            display="flex"
            alignItems="center"
            justifyContent="center"
            bgcolor="rgba(0,0,0,0.5)"
          >
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
          sx={{ flex: 1 }}
        >
          Register Face
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={startVerification}
          disabled={loading}
          startIcon={<KeyRoundIcon size={18} />}
          sx={{ flex: 1 }}
        >
          Verify Face
        </Button>
      </Box>

      {notificationMessage && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotificationMessage('')}>
          {notificationMessage}
        </Alert>
      )}

      {(registrationStage === 'input' || verificationStage === 'input') && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Box mb={2}>
            <Tooltip
              title="Enter two or more identifiers (comma-separated). Must match during verification."
              placement="top"
            >
              <TextField
                label="Identifiers"
                placeholder="e.g., username, email@example.com"
                fullWidth
                value={identifiersInput}
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
                value={encryptedFaceData || ''}
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

      {registrationResult && verificationStage === 'idle' && (
        <Box mt={3}>
          <Typography variant="h6" gutterBottom>Registration Result</Typography>
          <Box
            sx={{
              mt: 2,
              p: 2,
              bgcolor: '#f9f9f9',
              border: '1px solid #ddd',
              borderRadius: 1,
              overflow: 'auto', // Add scrollbar if content overflows
              maxHeight: 200, // Optional: set a maximum height
              wordBreak: 'break-word', // Prevent long words from breaking layout
            }}
          >
            <Typography variant="body2" component="pre">
              {registrationResult}
            </Typography>
          </Box>

          {encryptedFaceData && (
            <Alert
              severity="info"
              sx={{
                mt: 2,
                '& .MuiAlert-icon': { display: 'none' },
              }}
            >
              <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title="Save your Encrypted Face Data along with identifiers">
                  <InfoIcon size={18} style={{ cursor: 'pointer' }} />
                </Tooltip>
                Save your Encrypted Face Data
              </AlertTitle>
              <Box sx={{ wordBreak: 'break-word' }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {encryptedFaceData}
                </Typography>
                <Box display="flex" justifyContent="flex-end" alignItems="center" gap={1}>
                  {copied && (
                    <Typography variant="caption" color="success.main">
                      Copied!
                    </Typography>
                  )}
                  <Button variant="outlined" size="small" onClick={handleCopy}>
                    Copy
                  </Button>
                </Box>
              </Box>
            </Alert>
          )}
        </Box>
      )}

      {verificationResult && verificationStage === 'idle' && (
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