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
import { FixedSizeList } from "react-window";
import "./App.css";

const API_URL = "http://localhost:5000";

const DESTINATION_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "city",
  "country",
  "age",
  "fullName",
];

function VirtualRow({ index, style, data }) {
  const row = data.rows[index];

  return (
    <div className="virtual-row" style={style}>
      <div className="virtual-cell row-number">{row.rowNumber ?? index + 1}</div>
      {data.columns.map((column, columnIndex) => (
        <div className="virtual-cell" key={column.key}>
          {String(row.values?.[columnIndex] ?? "")}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [upload, setUpload] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mappings, setMappings] = useState({});
  const [transformations, setTransformations] = useState({});

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
    setMappings({});
    setTransformations({});

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch(
        `${API_URL}/api/files/upload`,
        { method: "POST", body: formData }
      );

      const uploadResult = await readResponse(uploadResponse);
      const uploadedFile = uploadResult.data;

      if (!uploadedFile?.uploadId) {
        throw new Error("The server did not return an upload ID.");
      }

      setUpload(uploadedFile);

      const previewResponse = await fetch(
        `${API_URL}/api/files/${encodeURIComponent(
          uploadedFile.uploadId
        )}/preview`
      );

      const previewResult = await readResponse(previewResponse);
      const previewData = previewResult.data;

      setPreview(previewData);

      const initialMappings = {};
      for (const column of previewData.columns ?? []) {
        initialMappings[column.key] = "";
      }
      setMappings(initialMappings);
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function updateMapping(sourceKey, destination) {
    setMappings((previous) => ({
      ...previous,
      [sourceKey]: destination,
    }));
  }

  function getSampleValue(column, columnIndex) {
    const value = preview?.rows?.[0]?.values?.[columnIndex] ?? "";
    const rule = transformations[column.key] ?? "none";

    if (rule === "capitalize") {
      return String(value)
        .toLowerCase()
        .replace(/\b\w/g, (character) => character.toUpperCase());
    }

    if (rule === "uppercase") {
      return String(value).toUpperCase();
    }

    return String(value);
  }

  const columns = preview?.columns ?? [];
  const rows = preview?.rows ?? [];

  // The configuration can be sent to a processing endpoint later.
  const mappingConfiguration = columns.map((column) => ({
    source: column.key,
    destination: mappings[column.key] || null,
    transformation: transformations[column.key] || "none",
  }));

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
          Upload a dataset, inspect its structure, and map your
          source columns to your desired output.
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
              ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
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
        <>
          <section className="workspace preview-workspace">
            <div className="section-heading">
              <div>
                <h3>Virtualized data preview</h3>
                <p>
                  {rows.length} preview rows · {columns.length} columns
                </p>
              </div>
              <span className="file-badge">PREVIEW</span>
            </div>

            {columns.length > 0 && rows.length > 0 ? (
              <div className="virtual-table">
                <div className="virtual-header">
                  <div className="virtual-cell row-number">#</div>
                  {columns.map((column) => (
                    <div className="virtual-cell" key={column.key}>
                      {column.label}
                    </div>
                  ))}
                </div>

                <FixedSizeList
                  height={360}
                  width="100%"
                  itemCount={rows.length}
                  itemSize={42}
                  itemData={{ rows, columns }}
                  overscanCount={5}
                >
                  {VirtualRow}
                </FixedSizeList>
              </div>
            ) : (
              <p>No data rows were found in this preview.</p>
            )}

            <p className="preview-note">
              Only visible rows and a small overscan region are rendered.
            </p>
          </section>

          <section className="workspace mapping-workspace">
            <div className="section-heading">
              <div>
                <h3>Column mapping</h3>
                <p>
                  Choose a destination field and optional transformation
                  for each source column.
                </p>
              </div>
            </div>

            <div className="mapping-list">
              {columns.map((column, index) => (
                <div className="mapping-item" key={column.key}>
                  <div className="mapping-source">
                    <span className="mapping-label">SOURCE</span>
                    <strong>{column.label}</strong>
                    <small>
                      Sample: {String(rows[0]?.values?.[index] ?? "")}
                    </small>
                  </div>

                  <div className="mapping-arrow">→</div>

                  <div className="mapping-controls">
                    <label>
                      <span className="mapping-label">DESTINATION</span>
                      <select
                        value={mappings[column.key] ?? ""}
                        onChange={(event) =>
                          updateMapping(column.key, event.target.value)
                        }
                      >
                        <option value="">Skip this column</option>
                        {DESTINATION_FIELDS.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span className="mapping-label">TRANSFORMATION</span>
                      <select
                        value={transformations[column.key] ?? "none"}
                        onChange={(event) =>
                          setTransformations((previous) => ({
                            ...previous,
                            [column.key]: event.target.value,
                          }))
                        }
                      >
                        <option value="none">None</option>
                        <option value="uppercase">Uppercase</option>
                        <option value="capitalize">Capitalize words</option>
                      </select>
                    </label>

                    <div className="sample-output">
                      <span className="mapping-label">SAMPLE OUTPUT</span>
                      <strong>{getSampleValue(column, index) || "—"}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="upload-button"
              onClick={() => {
                const invalid = Object.values(mappings).filter(Boolean);
                if (new Set(invalid).size !== invalid.length) {
                  setError("Each destination field can only be mapped once.");
                  return;
                }

                setError("");
                console.log("Mapping configuration:", mappingConfiguration);
                alert(
                  "Mapping configuration prepared. Full dataset processing is the next step."
                );
              }}
            >
              Validate mapping
            </button>
            <p className="preview-note">
              This currently prepares the mapping configuration and previews
              transformations. It does not yet transform or save the full dataset.
            </p>
          </section>
        </>
      )}

      <footer>
        StreamWeaver · Built for large-scale data processing
      </footer>
    </main>
  );
}