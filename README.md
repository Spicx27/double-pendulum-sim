# Double Pendulum Dynamics (B.Tech CE Physics Project)

An interactive, scientifically accurate simulation of a double pendulum system built to demonstrate nonlinear dynamics and chaotic behavior.

## Technologies Used
- React 18 & TypeScript
- Vite (Build Tool)
- HTML5 Canvas (Rendering engine)
- Custom RK4 Physics Engine

## Local Development Setup
1. Ensure Node.js is installed.
2. Clone or extract the project repository.
3. Run `npm install` to install dependencies.
4. Run `npm run dev` to start the local development server.
5. Open `http://localhost:5173` in your browser.

## Deployment to Vercel

### Option 1: Via GitHub (Recommended)
1. Initialize a git repository and push this code to a new GitHub repository.
2. Go to your [Vercel Dashboard](https://vercel.com/new).
3. Select "Import Project" and choose your GitHub repository.
4. Vercel will auto-detect Vite. Ensure the following settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **Deploy**.

### Option 2: Via Vercel CLI
1. Install the CLI: `npm i -g vercel`
2. Run `vercel` in the project root directory.
3. Follow the CLI prompts to deploy directly.

## Physics Assumptions
* The rods connecting the bobs are completely rigid and massless.
* Friction at the pivots and air resistance are assumed to be zero (to demonstrate energy conservation).
* The gravitational acceleration is uniform downwards.