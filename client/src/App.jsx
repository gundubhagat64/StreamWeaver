// import { useState } from 'react'
// import heroImg from './assets/hero.png'
// import reactLogo from './assets/react.svg'
// import viteLogo from './assets/vite.svg'
// import './App.css'

// function App() {
//   const [count, setCount] = useState(0)

//   return (
//     <>
//       <section id="center">
//         <div className="hero">
//           <img src={heroImg} className="base" width="170" height="179" alt="" />
//           <img src={reactLogo} className="framework" alt="React logo" />
//           <img src={viteLogo} className="vite" alt="Vite logo" />
//         </div>
//         <div>
//           <h1>Get started</h1>
//           <p>
//             Edit <code>src/App.jsx</code> and save to test <code>HMR</code>
//           </p>
//         </div>
//         <button
//           type="button"
//           className="counter"
//           onClick={() => setCount((count) => count + 1)}
//         >
//           Count is {count}
//         </button>
//       </section>

//       <div className="ticks"></div>

//       <section id="next-steps">
//         <div id="docs">
//           <svg className="icon" role="presentation" aria-hidden="true">
//             <use href="/icons.svg#documentation-icon"></use>
//           </svg>
//           <h2>Documentation</h2>
//           <p>Your questions, answered</p>
//           <ul>
//             <li>
//               <a href="https://vite.dev/" target="_blank">
//                 <img className="logo" src={viteLogo} alt="" />
//                 Explore Vite
//               </a>
//             </li>
//             <li>
//               <a href="https://react.dev/" target="_blank">
//                 <img className="button-icon" src={reactLogo} alt="" />
//                 Learn more
//               </a>
//             </li>
//           </ul>
//         </div>
//         <div id="social">
//           <svg className="icon" role="presentation" aria-hidden="true">
//             <use href="/icons.svg#social-icon"></use>
//           </svg>
//           <h2>Connect with us</h2>
//           <p>Join the Vite community</p>
//           <ul>
//             <li>
//               <a href="https://github.com/vitejs/vite" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#github-icon"></use>
//                 </svg>
//                 GitHub
//               </a>
//             </li>
//             <li>
//               <a href="https://chat.vite.dev/" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#discord-icon"></use>
//                 </svg>
//                 Discord
//               </a>
//             </li>
//             <li>
//               <a href="https://x.com/vite_js" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#x-icon"></use>
//                 </svg>
//                 X.com
//               </a>
//             </li>
//             <li>
//               <a href="https://bsky.app/profile/vite.dev" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#bluesky-icon"></use>
//                 </svg>
//                 Bluesky
//               </a>
//             </li>
//           </ul>
//         </div>
//       </section>

//       <div className="ticks"></div>
//       <section id="spacer"></section>
//     </>
//   )
// }

// export default App


import { useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000";

export default function App() {
  const [file, setFile] = useState(null);
  const [upload, setUpload] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function readResponse(response) {
    const result = await response.json();

    if (!response.ok || result.success === false) {
      throw new Error(
        result.message || `Request failed (${response.status})`
      );
    }

    return result;
  }

  async function handleUpload() {
    if (!file) {
      setError("Please select a CSV file.");
      return;
    }

    setLoading(true);
    setError("");
    setUpload(null);
    setPreview(null);

    try {
      // Step 1: Upload the file.
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch(
        `${API_URL}/api/files/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const uploadResult = await readResponse(uploadResponse);
      const uploadedFile = uploadResult.data;

      if (!uploadedFile?.uploadId) {
        throw new Error(
          "Upload succeeded, but the server did not return an upload ID."
        );
      }

      setUpload(uploadedFile);

      // Step 2: Request a bounded preview from the backend.
      const previewResponse = await fetch(
        `${API_URL}/api/files/${encodeURIComponent(
          uploadedFile.uploadId
        )}/preview`
      );

      const previewResult = await readResponse(previewResponse);

      setPreview(previewResult.data);
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function formatBytes(bytes) {
    if (bytes == null) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">SW</div>
          <div>
            <h1>StreamWeaver</h1>
            <p>High-throughput, no-code ETL pipeline</p>
          </div>
        </div>

        <div className="connection">
          <span className="status-dot" />
          Local development
        </div>
      </header>

      <section className="hero">
        <span className="eyebrow">DATA PIPELINE WORKSPACE</span>
        <h2>Move massive data. Without the mess.</h2>
        <p>
          Upload your dataset and inspect its structure before
          mapping and transforming your data.
        </p>
      </section>

      <section className="workspace">
        <div className="section-heading">
          <div>
            <h3>Import dataset</h3>
            <p>Select a CSV file to get started.</p>
          </div>
          <span className="file-badge">CSV</span>
        </div>

        <label className="dropzone">
          <div className="upload-icon">↑</div>
          <strong>{file ? file.name : "Choose your dataset"}</strong>
          <span>
            {file
              ? formatBytes(file.size)
              : "Select a CSV file from your computer"}
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={loading}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError("");
              setUpload(null);
              setPreview(null);
            }}
          />
        </label>

        <button
          className="upload-button"
          onClick={handleUpload}
          disabled={!file || loading}
        >
          {loading ? "Uploading and preparing preview..." : "Upload and preview"}
          {!loading && <span>→</span>}
        </button>

        {error && (
          <div className="message error-message" role="alert">
            {error}
          </div>
        )}

        {upload && (
          <div className="message success-message" role="status">
            <strong>File uploaded successfully</strong>
            <div>{upload.originalFileName}</div>
            <small>Upload ID: {upload.uploadId}</small>
          </div>
        )}
      </section>

      {preview && (
        <section className="workspace preview-workspace">
          <div className="section-heading">
            <div>
              <h3>Dataset preview</h3>
              <p>
                Showing {preview.previewCount} preview rows
                {preview.hasMoreRows
                  ? ` · More rows exist in the dataset`
                  : " · End of dataset"}
              </p>
            </div>
            <span className="file-badge">
              {preview.columns.length} columns
            </span>
          </div>

          {preview.warnings?.length > 0 && (
            <div className="message">
              {preview.warnings.map((warning) => (
                <p key={warning.code}>{warning.message}</p>
              ))}
            </div>
          )}

          {preview.columns.length > 0 && preview.rows.length > 0 ? (
            <div className="table-scroll">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {preview.columns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      {preview.columns.map((column, index) => (
                        <td key={column.key}>
                          {row.values[index] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No data rows were found in the preview.</p>
          )}

          <p className="preview-note">
            This is a bounded preview, not the full dataset.
          </p>
        </section>
      )}

      <section className="pipeline">
        <div className="pipeline-step active">
          <span>01</span>
          <div>
            <strong>Upload</strong>
            <small>Import your file</small>
          </div>
        </div>
        <div className={`pipeline-step ${preview ? "active" : ""}`}>
          <span>02</span>
          <div>
            <strong>Preview</strong>
            <small>Inspect CSV records</small>
          </div>
        </div>
        <div className="pipeline-step">
          <span>03</span>
          <div>
            <strong>Transform</strong>
            <small>Next: map columns</small>
          </div>
        </div>
      </section>

      <footer>
        StreamWeaver · Built for large-scale data processing
      </footer>
    </main>
  );
}