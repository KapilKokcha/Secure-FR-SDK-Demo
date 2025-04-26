import React, { useRef, useState, useEffect } from 'react';

const Button = ({ children, onClick, disabled, className }) => (
  <button onClick={onClick} disabled={disabled} className={className}>
    {children}
  </button>
);

const Alert = ({ variant, className, children }) => <div className={`${className} ${variant === 'destructive' ? 'bg-red-100 text-red-800' : ''}`}>{children}</div>;
const AlertTitle = ({ children }) => <h2 className="font-bold">{children}</h2>;
const AlertDescription = ({ children }) => <p>{children}</p>;

const cn = (...classes) => classes.filter(Boolean).join(' ');

const loadSDK = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = '/sdk/face-sdk.umd.js';
    script.onload = () => {
      resolve(window.FaceSDK);
    };
    // console.log(window.FaceSDK);
    script.onerror = () => {
        console.error("Failed to load FaceSDK");
        resolve(null);
    }
    document.body.appendChild(script);
  });
};

const FaceAuth = () => {
  const videoRef = useRef(null);
  const [faceSDK, setFaceSDK] = useState(null);
  const [registrationResult, setRegistrationResult] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [encryptedFaceData, setEncryptedFaceData] = useState(null);
  const identifiersRef = useRef(['user123', 'email@example.com']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const sdk = await loadSDK();
        console.log("sdk = ",sdk );
        setFaceSDK(sdk);
        if (sdk) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              console.log(videoRef.current.srcObject);
            }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };
    init();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  const handleRegister = async () => {
    if (!faceSDK || !videoRef.current) {
      setError('SDK not loaded or video stream not available.');
      return;
    }
    setError(null);
    setLoading(true);
    setRegistrationResult(null);
    setVerificationResult(null);
    try {
      const result = await faceSDK.FaceSDK.registerFace(identifiersRef.current, videoRef.current);
      console.log(result);
      setRegistrationResult(JSON.stringify(result, null, 2));
      setEncryptedFaceData(result.encryptedFace);
      alert('Face registered successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!faceSDK || !videoRef.current || !encryptedFaceData) {
      setError('SDK not loaded, video stream not available, or no registration data.');
      return;
    }
    setError(null);
    setLoading(true);
    setVerificationResult(null);
    try {
      const isMatch = await faceSDK.FaceSDK.verifyFace(encryptedFaceData, identifiersRef.current, videoRef.current);
      console.log(isMatch);
      setVerificationResult(isMatch ? 'Face verified!' : 'Face not matched.');
      alert(isMatch ? 'Face verified!' : 'Face not matched.');
    } catch (err) {
        const message = err instanceof Error ? err.message : "Verification failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-100 p-4">
      <h2 className="text-2xl font-bold mb-4">Face Authentication</h2>

      <div className="relative w-full max-w-md">
          <video
            ref={videoRef}
            width="100%"
            height="auto"
            autoPlay
            muted
            className="rounded-lg border border-gray-300 shadow-md"
          />
        {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        )}
      </div>

      <div className="mt-4 space-x-4">
        <Button
          onClick={handleRegister}
          disabled={loading}
          className={cn(
            "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded",
            loading && "opacity-50 cursor-not-allowed"
          )}
        >
          Register Face
        </Button>
        {encryptedFaceData && (
          <Button
            onClick={handleVerify}
            disabled={loading}
            className={cn(
              "bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded",
              loading && "opacity-50 cursor-not-allowed"
            )}
          >
            Verify Face
          </Button>
        )}
      </div>

      {registrationResult && (
        <div className="mt-4 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-2">Registration Result:</h3>
          <pre className="bg-gray-800 text-white p-4 rounded-md overflow-auto max-h-48">
            {registrationResult}
          </pre>
        </div>
      )}

      {verificationResult && (
        <div className="mt-4 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-2">Verification Result:</h3>
          <p className={cn(
            "p-3 rounded-md text-center",
            verificationResult === 'Face verified!' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          )}>
            {verificationResult}
          </p>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-4 w-full max-w-md">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <FaceAuth />
    </div>
  );
}

export default App;