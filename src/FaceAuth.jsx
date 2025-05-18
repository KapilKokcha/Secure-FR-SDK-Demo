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

// const loadSDK = () => {
//   return new Promise((resolve, reject) => {
//     const script = document.createElement('script');
//     script.src = SDK_URL;
//     script.onload = () => {
//       if (window.FaceSDK && window.FaceSDK.isReady) {
//         resolve(window.FaceSDK);
//       } else if (window.FaceSDK && typeof window.FaceSDK.onReady === 'function') {
//         window.FaceSDK.onReady(() => resolve(window.FaceSDK));
//       } else {
//         console.warn("FaceSDK loaded, but no explicit 'isReady' or 'onReady' found. Proceeding with caution.");
//         resolve(window.FaceSDK);
//       }
//     };
//     script.onerror = () => {
//       console.error('Failed to load FaceSDK');
//       reject(new Error('Failed to load FaceSDK'));
//     };
//     document.body.appendChild(script);
//   });
// };

const loadSDK = () => {
  return new Promise(async (resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onload = async () => {
      if (window.FaceSDK) {
        try {
          // Ensure models are loaded before resolving the SDK
          console.log(window.FaceSDK);
          // await window.FaceSDK.FaceSDK.FaceCaptureService.loadModels();
          // await window.FaceSDK.FaceSDK.FaceLandmarkService.loadModelsIfNeeded();
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
  const [landmarks, setLandmarks] = useState(null);

  const identifiers = identifiersInput.split(',').map((s) => s.trim()).filter(Boolean);

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

  const handleCopy = () => {
    navigator.clipboard.writeText(encryptedFaceData).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
      alert('Face registered successfully! Save your encrypted face data.');
    } catch (err) {
      if (err.message === "No face detected") {
        setRegistrationStage('input');
        setError(err.message);
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
        setError(err.message);
        setVerificationStage('input');
        return;
      }
      setError(err.message || 'Verification failed');
    } finally {
      setVerificationStage('idle');
      setLoading(false);
    }
  }, [faceSDK, encryptedFaceData, identifiers]);

  // const drawLandmarks = useCallback((ctx, points) => {
  //   console.log("yay");
  //   if (!points || points.length === 0) return;

  //   ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  //   ctx.fillStyle = 'yellow';
  //   ctx.strokeStyle = 'yellow';
  //   ctx.lineWidth = 2;

  //   points.forEach((point) => {
  //     ctx.beginPath();
  //     ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
  //     ctx.fill();
  //   });

  //   for (let i = 0; i < points.length - 1; i++) {
  //     ctx.beginPath();
  //     ctx.moveTo(points[i].x, points[i].y);
  //     ctx.lineTo(points[i + 1].x, points[i + 1].y);
  //     ctx.stroke();
  //   }
  //    console.log("yay");
  // }, []);

  const drawLandmarks = useCallback((ctx, points) => {
    if (!points || points.length === 0) return;

    const videoWidth = videoRef.current ? videoRef.current.videoWidth : 0;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = 'yellow';
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;

    points.forEach((point) => {
      // Flip the x-coordinate for drawing
      const flippedX = videoWidth - point.x;
      ctx.beginPath();
      ctx.arc(flippedX, point.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
    for (let i = 0; i < points.length - 1; i++) {
      // Flip the x-coordinates for drawing lines
      const flippedX1 = videoWidth - points[i].x;
      const flippedX2 = videoWidth - points[i + 1].x;
      ctx.beginPath();
      ctx.moveTo(flippedX1, points[i].y);
      ctx.lineTo(flippedX2, points[i + 1].y);
      ctx.stroke();
    }
  }, []);

  useEffect(() => {
    const draw = async () => {
      if (faceSDK && faceSDK.FaceSDK && videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
        const videoElement = videoRef.current;
        const canvasElement = canvasRef.current;
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        const ctx = canvasElement.getContext('2d');
        if (ctx) {
          try {
            const currentLandmarks = await faceSDK.FaceSDK.detectLandmarks(videoRef.current);
            setLandmarks(currentLandmarks);
            console.log("Landmarks:", currentLandmarks);
            drawLandmarks(ctx, currentLandmarks);
          } catch (error) {
            console.error("Error detecting landmarks:", error);
          }
        } else {
          console.error("Canvas context not available in draw loop.");
        }
      }
      requestAnimationFrame(draw);
    };

    if (faceSDK && faceSDK.FaceSDK) {
      draw();
    }
  }, [drawLandmarks, faceSDK]);

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
    setLandmarks(null);
    setVerificationResult(null);
    identifierInputRef.current?.focus();
  };

  const startVerification = () => {
    setVerificationStage('input');
    setRegistrationStage('idle');
    setError(null);

    if (justRegistered) {
      setIdentifiersInput(preFilledIdentifiers.join(', '));
      setEncryptedFaceData(preFilledEncryptedFaceData);
      setNotificationMessage("We've pre-filled your details from the recent registration.");
      setLandmarks(null);
      setRegistrationResult();

      setTimeout(function () {
        setNotificationMessage();
      }, 5000);
    } else {
      setIdentifiersInput('');
      setEncryptedFaceData(null);
      setVerificationResult(null);
      setLandmarks(null);
    }

    setJustRegistered(false);
    identifierInputRef.current?.focus();
  };

  useEffect(() => {
    const draw = async () => {
      if (faceSDK && videoRef.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        const currentLandmarks = await faceSDK.FaceSDK.detectLandmarks(videoRef.current);
        console.log("Landmarks:", currentLandmarks);
        setLandmarks(currentLandmarks);
        drawLandmarks(ctx, currentLandmarks);
      }
      requestAnimationFrame(draw);
    };
    draw();
  }, [drawLandmarks, faceSDK]);

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
        <video
          ref={videoRef}
          autoPlay
          muted
          style={{
            width: '100%',
            borderRadius: 8,
            transform: 'scaleX(-1)',
            filter: 'brightness(1.1) contrast(1.2) saturate(1.5)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
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
            borderRadius: 8,
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
              title="Enter two or more identifiers (comma-separated). IMP : This must match during verification."
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

      {registrationResult && (
        <Box mt={3}>
          <Typography variant="h6" gutterBottom>Registration Result</Typography>

          {(() => {
            try {
              const parsed = JSON.parse(registrationResult);
              const { createdAt, modelVersion } = parsed.metadata || {};
              return (
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    bgcolor: '#f9f9f9',
                    border: '1px solid #ddd',
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="subtitle1" gutterBottom>Metadata</Typography>
                  <Typography variant="body2"><strong>Created At:</strong> {createdAt || 'N/A'}</Typography>
                  <Typography variant="body2"><strong>Model Version:</strong> {modelVersion || 'N/A'}</Typography>
                </Box>
              );
            } catch {
              return null;
            }
          })()}

          {encryptedFaceData && (
            <Alert
              severity="info"
              sx={{
                mt: 2,
                '& .MuiAlert-icon': { display: 'none' },
              }}
            >
              <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title="Save your Encrypted Face Data, along with identifiers – they will be required during login.">
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
