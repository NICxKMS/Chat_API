/**
 * Performance Benchmark Script
 * 
 * This script runs the server with various Clinic.js profiling tools
 * to analyze performance bottlenecks and generate visualizations.
 */
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  // Server command
  serverCommand: 'node src/server.js',
  
  // Port for testing - this will be the STARTING port
  port: process.env.PORT || 3000,
  
  // Load test configuration
  loadTest: {
    duration: 30, // seconds
    connections: 5,
    pipelining: 5,
    timeout: 10
  },
  
  // Clinic tools to run (in sequence)
  tools: ['doctor', 'bubbleprof', 'flame', 'heapprofiler'],
  
  // Output directory for reports
  outputDir: path.join(__dirname, '../benchmark-results')
};

// Command line args processing
const args = process.argv.slice(2);
const selectedTools = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (config.tools.includes(arg)) {
    selectedTools.push(arg);
  } else if (arg === '--duration' && args[i + 1]) {
    config.loadTest.duration = parseInt(args[i + 1], 10);
    i++;
  } else if (arg === '--connections' && args[i + 1]) {
    config.loadTest.connections = parseInt(args[i + 1], 10);
    i++;
  } else if (arg === '--port' && args[i + 1]) {
    config.port = parseInt(args[i + 1], 10);
    i++;
  } else if (arg === '--help') {
    console.log(`
Performance Benchmark Script

Usage:
  node benchmark.js [tools] [options]

Tools (run one or more):
  doctor        Run Clinic Doctor to identify bottlenecks
  bubbleprof    Run Clinic Bubbleprof to analyze async operations
  flame         Run Clinic Flame to generate CPU flame graphs
  heapprofiler  Run Clinic Heap Profiler to analyze memory usage

Options:
  --duration N      Load test duration in seconds (default: ${config.loadTest.duration})
  --connections N   Number of concurrent connections (default: ${config.loadTest.connections})
  --port N          Starting server port (default: ${config.port})
  --help            Show this help message

Examples:
  node benchmark.js doctor flame --duration 60
  node benchmark.js bubbleprof --connections 100
    `);
    process.exit(0);
  }
}

// If no specific tools selected, run all
if (selectedTools.length === 0) {
  selectedTools.push(...config.tools);
}

// Ensure output directory exists
try {
  fs.mkdirSync(config.outputDir, { recursive: true });
} catch (error) {
  if (error.code !== 'EEXIST') {
    console.error(`Error creating output directory: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Run a specific clinic tool
 * @param {string} tool The name of the clinic tool.
 * @param {number} port The port number to use for this specific run.
 */
function runClinicTool(tool, port) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== Starting analysis with Clinic ${tool} on port ${port} ===\n`);

    // Build the clinic command args
    const clinicArgs = [
      tool,
      `--port=${port}`,
      '--',
      ...config.serverCommand.split(' ')
    ];

    // Use spawn for better process control
    // Use shell: true to handle npx correctly, especially on Windows
    const clinicProcess = spawn('npx', ['clinic', ...clinicArgs], {
      stdio: 'pipe', // Capture stdio to parse output
      shell: true,
      env: { // Explicitly set PORT environment variable for the child process
        ...process.env, // Inherit existing environment variables
        PORT: port.toString() // Set the specific port for this run
      },
      // Run in detached mode on non-windows to kill process group later
      detached: process.platform !== 'win32'
    });

    console.log(`Spawned Clinic ${tool} process with PID: ${clinicProcess.pid}`);

    let serverReady = false;
    let processOutput = '';

    clinicProcess.stdout.on('data', (data) => {
      const output = data.toString();
      processOutput += output;
      // Log stdout transparently, prefixing for clarity
      console.log(`[Clinic ${tool} STDOUT] ${output.trim()}`);
      // Simple check for server readiness - adjust trigger phrases if needed
      if (!serverReady && (output.includes(`Server listening on port ${port}`) || output.includes(`server running at ${port}`) || output.includes(`Server running on port ${port}`) || output.includes(`Profiling on port ${port}`))) {
         console.log(`Clinic ${tool}: Server detected as ready on port ${port}.`);
         clearTimeout(startupTimer);
         serverReady = true;
         runLoadTestAndSignal();
      }
    });

    clinicProcess.stderr.on('data', (data) => {
      const output = data.toString();
      processOutput += output;
      // Log stderr transparently, prefixing for clarity
      console.error(`[Clinic ${tool} STDERR] ${output.trim()}`);
       // Check for Address In Use error specifically
      if (output.includes('EADDRINUSE') || output.includes('address already in use')) {
        console.error(`Error: Port ${port} seems to be in use during startup (Clinic ${tool}).`);
        clearTimeout(startupTimer);
        // Attempt to kill the process if it started but failed
        if (clinicProcess.pid) {
            try {
                 // Try killing the process group on POSIX, or just the process on Windows
                 process.kill(process.platform === "win32" ? clinicProcess.pid : -clinicProcess.pid, 'SIGTERM');
            } catch (killError) {
                 console.error(`Failed to kill lingering process ${clinicProcess.pid}: ${killError.message}`);
            }
        }
        reject(new Error(`Port ${port} already in use (detected during Clinic run for ${tool}).`));
      }
    });

     clinicProcess.on('error', (err) => {
       console.error(`Failed to start clinic process for ${tool}: ${err.message}`);
       clearTimeout(startupTimer);
       reject(err);
     });

    clinicProcess.on('exit', (code, signal) => {
      clearTimeout(startupTimer);
      console.log(`Clinic ${tool} process exited with code ${code} and signal ${signal}`);
      // Clinic often exits with code null/signal SIGINT when stopped correctly after profiling
      if (code === 0 || (signal === 'SIGINT' && code === null) || (signal === 'SIGTERM' && code === null) || (code === 130 && signal === null)) { // 130 can be exit code from SIGINT on some systems
        // Process exited cleanly or was terminated as expected after profiling
         moveReports(tool)
           .then(() => {
               console.log(`\n=== Clinic ${tool} analysis complete ===\n`);
               resolve();
            })
           .catch(reject);
      } else {
          console.error(`Clinic ${tool} exited unexpectedly. Exit code: ${code}, Signal: ${signal}`);
          console.error("Full output collected:\n", processOutput);
          reject(new Error(`Clinic ${tool} failed. Exit code: ${code}, Signal: ${signal}. Check logs for details.`));
      }
    });

    // Function to run load test and then signal clinic to stop
    async function runLoadTestAndSignal() {
        try {
             // Give a brief moment for server routes to fully initialize after port binds
             await new Promise(resolve => setTimeout(resolve, 1500));

             console.log(`\nRunning load test with ${config.loadTest.connections} connections for ${config.loadTest.duration} seconds...\n`);

             const cannonCmd = `npx autocannon http://localhost:${port}/api/chat/completions ` +
               `-c ${config.loadTest.connections} ` +
               `-d ${config.loadTest.duration} ` +
               `-p ${config.loadTest.pipelining} ` +
               `-t ${config.loadTest.timeout} ` +
               `-m POST ` +
               `-H "Content-Type: application/json" ` +
               `-b '{"model":"openai/gpt-3.5-turbo","messages":[{"role":"user","content":"Hello, world!"}],"temperature":0.7,"max_tokens":50}'`;

             // Run autocannon synchronously - it needs to finish before we stop clinic
             execSync(cannonCmd, { stdio: 'inherit' });

             console.log(`Load test finished. Stopping Clinic ${tool}...`);

             // Send SIGINT to the clinic process group to gracefully shut down
             // On Windows, process.kill only accepts pid, not -pid.
            if (clinicProcess.pid) {
                try {
                    // Send SIGINT first for graceful shutdown
                    const pidToKill = process.platform === "win32" ? clinicProcess.pid : -clinicProcess.pid;
                    console.log(`Sending SIGINT to PID: ${pidToKill}`);
                    process.kill(pidToKill, 'SIGINT');
                } catch (killError) {
                    console.error(`Failed to send SIGINT to process ${clinicProcess.pid}: ${killError.message}. Trying SIGTERM.`);
                     try {
                        const pidToKill = process.platform === "win32" ? clinicProcess.pid : -clinicProcess.pid;
                        console.log(`Sending SIGTERM to PID: ${pidToKill}`);
                        process.kill(pidToKill, 'SIGTERM');
                    } catch (termError) {
                        console.error(`Failed to send SIGTERM to process ${clinicProcess.pid}: ${termError.message}`);
                    }
                }
            } else {
                console.warn(`Clinic process ${tool} PID not found, cannot send signal.`);
            }

        } catch (error) {
           console.error(`Error during load test or signaling for ${tool}: ${error.message}`);
           // Attempt to forcefully kill the process if load test fails
           if (clinicProcess.pid) {
                try {
                     const pidToKill = process.platform === "win32" ? clinicProcess.pid : -clinicProcess.pid;
                     console.log(`Force killing PID: ${pidToKill} due to error.`);
                     process.kill(pidToKill, 'SIGKILL'); // Force kill
                } catch (killError) {
                     console.error(`Failed to force kill process ${clinicProcess.pid}: ${killError.message}`);
                }
            }
           reject(error);
        }
    }

     // Timeout for server startup detection
     const startupTimer = setTimeout(() => {
         if (!serverReady) {
             console.error(`Clinic ${tool}: Server did not signal readiness within 30 seconds.`);
             if (clinicProcess.pid) {
                 try {
                     const pidToKill = process.platform === "win32" ? clinicProcess.pid : -clinicProcess.pid;
                     console.log(`Force killing PID: ${pidToKill} due to startup timeout.`);
                     process.kill(pidToKill, 'SIGKILL'); // Force kill if timeout
                 } catch (killError) {
                      console.error(`Failed to kill timed-out process ${clinicProcess.pid}: ${killError.message}`);
                 }
             }
             reject(new Error(`Server startup timeout for Clinic ${tool}. Check server logs or increase timeout.`));
         }
     }, 30000); // 30 second timeout for server start signal

  });
}

/**
 * Move reports after clinic finishes
 */
async function moveReports(tool) {
   console.log(`Moving reports for ${tool}...`);
   // Wait a moment for file system operations to complete, especially after process exit
   await new Promise(resolve => setTimeout(resolve, 2000));

   try {
        // Clinic generates files like `.clinic/${pid}.clinic-doctor`, `${pid}.clinic-doctor.html`
        // Or directly `doctor.html`, `flame.html` etc. depending on version/flags
        // Let's look for common patterns in the current directory.
       const reportFiles = fs.readdirSync('.', { withFileTypes: true })
           .filter(dirent =>
                (dirent.isFile() && dirent.name.startsWith(`${tool}.`) && (dirent.name.endsWith('.html') || dirent.name.endsWith('.json'))) ||
                (dirent.isDirectory() && dirent.name === '.clinic') ||
                (dirent.isFile() && dirent.name.includes(`.clinic-${tool}`) && dirent.name.endsWith('.html'))
            )
           .map(dirent => dirent.name);

        // Check inside .clinic directory as well, if it exists
        const clinicDir = '.clinic';
        if (fs.existsSync(clinicDir)) {
             const clinicDirFiles = fs.readdirSync(clinicDir)
                 .filter(file => file.includes(`.${tool}`) && (file.endsWith('.html') || file.endsWith('.json') || file.endsWith(`-${tool}`)))
                 .map(file => path.join(clinicDir, file));
             reportFiles.push(...clinicDirFiles);
        }


       if (reportFiles.length === 0) {
            console.warn(`No report files found matching patterns for ${tool} in the current directory or .clinic subdir.`);
            // Check output dir just in case clinic put them there? Unlikely.
            const outputDirFiles = fs.existsSync(config.outputDir) ? fs.readdirSync(config.outputDir) : [];
            const recentFiles = outputDirFiles.filter(file => file.includes(tool) && file.includes(new Date().toISOString().slice(0, 10)));
            if (recentFiles.length > 0) {
                 console.log(`Found potential recent report files in output directory: ${recentFiles.join(', ')}`);
            } else {
                 console.error(`Failed to find report files for ${tool}. Check clinic output above for errors or report generation issues.`);
            }
            return;
       }

       console.log(`Found potential report files/dirs: ${reportFiles.join(', ')}`);

       fs.mkdirSync(config.outputDir, { recursive: true });

       for (const fileOrDirName of reportFiles) {
           const sourcePath = path.resolve(fileOrDirName);
           const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
           // Keep original name structure but prepend timestamp
           const baseName = path.basename(fileOrDirName);
           const newFileName = `${timestamp}-${baseName}`;
           const newPath = path.join(config.outputDir, newFileName);

            try {
                 if (!fs.existsSync(sourcePath)) {
                      console.warn(`Source path ${sourcePath} disappeared before moving. Skipping.`);
                      continue;
                 }
                 console.log(`Attempting to move ${sourcePath} to ${newPath}`);
                 fs.renameSync(sourcePath, newPath);
                 console.log(`Report saved to: ${newPath}`);
            } catch (renameError) {
                 console.error(`Error moving report ${sourcePath} to ${newPath}: ${renameError.message}`);
            }
       }
   } catch (error) {
       console.error(`Error accessing or reading files/directories for moving reports (${tool}): ${error.message}`);
   }
}

/**
 * Main benchmark function
 */
async function runBenchmarks() {
  console.log(`
===================================================
       Chat API Server Performance Benchmark       
===================================================

Server Command: ${config.serverCommand}
Starting Port: ${config.port}
Load Test: ${config.loadTest.connections} connections for ${config.loadTest.duration} seconds
Tools: ${selectedTools.join(', ')} (+ ports ${config.port} to ${config.port + selectedTools.length -1})
Output Directory: ${config.outputDir}

===================================================
  `);
  
  let success = true;
  const failedTools = [];
  for (const tool of selectedTools) {
    let toolSuccess = false;
    try {
      // Calculate the port for this specific tool run
      const toolIndex = selectedTools.indexOf(tool);
      const currentPort = config.port + toolIndex;
      console.log(`\n--- Starting benchmark for ${tool} on port ${currentPort} ---`);

      await runClinicTool(tool, currentPort); // Pass the specific port
      toolSuccess = true;
    } catch (error) {
      console.error(`\n !!! Benchmark run for tool '${tool}' encountered an error. See details above. !!!\n`);
      success = false;
      failedTools.push(tool);
    }
    // Add a delay between tools to ensure ports are fully released, process cleans up etc.
    if (selectedTools.indexOf(tool) < selectedTools.length - 1) {
        // Reduce delay now that ports aren't reused immediately
        console.log("\n---\n Waiting 1 second before next tool... \n---\n");
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`
===================================================
          Benchmark Testing ${success ? 'Complete' : 'Finished with Errors'}
===================================================

${success ? `All reports should be saved to: ${config.outputDir}` : `Benchmark failed for tools: ${failedTools.join(', ')}. Check logs above. Reports saved to: ${config.outputDir}`}

To analyze the reports, open the HTML files in your browser.
  `);

  if (!success) {
       process.exitCode = 1;
  }
}

// Run the benchmarks
runBenchmarks().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 