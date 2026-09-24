/* =========================================================
   ZEROCLUB — CONTENT DATA
   Keep all editable copy/content here, separate from
   presentation logic, so new projects/services are easy
   to add later without touching markup or animation code.
   ========================================================= */

const ZC_DATA = {

  services: [
    {
      n: "01",
      title: "Custom Websites",
      short: "Modern websites designed around your brand, audience and goals.",
      items: ["Business websites", "Portfolio websites", "Landing pages", "Personal brands", "Corporate websites", "Responsive layouts", "Custom animations"]
    },
    {
      n: "02",
      title: "Web Applications",
      short: "Custom web applications built around your workflow or product idea.",
      items: ["Dashboards", "Admin panels", "User authentication", "Databases", "APIs", "Real-time functionality", "Custom business tools"]
    },
    {
      n: "03",
      title: "AI-Powered Products",
      short: "Technology-driven experiences using AI and computer vision.",
      items: ["AI interfaces", "Computer vision", "Image analysis", "Sign-language recognition", "Intelligent automation", "AI-assisted workflows"]
    },
    {
      n: "04",
      title: "UI / UX",
      short: "Interfaces that are easy to understand and enjoyable to use.",
      items: ["Interface design", "Responsive layouts", "Interaction design", "Design systems", "Prototyping", "User flows"]
    },
    {
      n: "05",
      title: "Redesign & Modernization",
      short: "Turn an outdated website into something modern.",
      items: ["Visual redesign", "Mobile optimization", "Performance improvements", "UX improvements", "Animation", "Accessibility improvements"]
    },
    {
      n: "06",
      title: "Deployment & Launch",
      short: "Taking the project from local development to a live website.",
      items: ["Domain setup", "Deployment", "Hosting configuration", "SSL", "Production setup", "Basic maintenance"]
    }
  ],

  tech: {
    Frontend: ["HTML", "CSS", "JavaScript", "AngularJS", "Responsive Design"],
    Backend: ["Node.js", "Express.js", "Python"],
    Databases: ["PostgreSQL", "MySQL", "Relational DB Design"],
    Programming: ["C", "C++", "OOP"],
    "AI / Computer Vision": ["Python", "OpenCV", "MediaPipe", "Machine Learning"],
    Other: ["Git", "GitHub", "REST APIs", "WebSockets", "Deployment"]
  },

  projects: [
    {
      id: "camsense",
      n: "01",
      name: "CamSense",
      image: "",
      category: "Computer Vision / Real-Time Object Detection",
      summary: "A real-time computer vision system that detects objects through a live camera feed and logs detection data for later analysis.",
      tech: ["Python", "OpenCV", "MobileNet SSD", "Node.js", "Express", "WebSockets", "PostgreSQL"],
      links: { github: "#", demo: null },
      problem: "Most lightweight object-detection demos stop at the model — there's no path from a live camera feed to something a person can actually review afterward.",
      approach: "CamSense pairs a MobileNet SSD detection pipeline with a real-time transport layer, so every frame's detections are streamed out instantly instead of only rendered locally.",
      build: "A Python service runs MobileNet SSD over the live camera feed, drawing bounding boxes and confidence scores. Detections are pushed over WebSockets to a Node.js/Express backend, which persists detection events — object class, confidence, position, timestamp — to PostgreSQL for later querying.",
      features: ["Real-time object detection", "Live camera input", "Visual bounding boxes", "Detection confidence scoring", "Object position tracking", "PostgreSQL detection logs", "WebSocket streaming", "Backend processing pipeline"],
      result: "A working pipeline from live video to a queryable detection history — the kind of foundation a monitoring, inventory, or safety-tracking tool would build on."
    },
    {
      id: "signspeak",
      n: "02",
      name: "SignSpeak AI",
      image: "",
      category: "AI / Accessibility / Communication",
      summary: "A communication platform designed to bridge sign language and spoken communication through real-time recognition, captions and speech interaction.",
      tech: ["Python", "JavaScript", "HTML", "CSS", "Node.js", "Computer Vision", "AI/ML"],
      links: { github: "#", demo: null },
      problem: "Video calls are built around speech. For sign-language users, that leaves a gap — captions rarely account for sign input, and the burden of translation falls on the deaf or hard-of-hearing participant.",
      approach: "Treat sign recognition as a first-class input alongside audio: detect signs in the video stream, convert them to text, and surface everything through the same live caption bar as spoken speech.",
      build: "A computer-vision pipeline tracks hand and gesture landmarks to recognize signs and convert them to text. In parallel, speech-to-text and text-to-speech handle the spoken side. Both feed a shared live-caption interface inside a video-conferencing shell with camera/microphone controls and speaker identification.",
      features: ["Sign-language detection", "Sign-to-text conversion", "Speech-to-text captions", "Text-to-speech output", "Video conferencing interface", "Camera and microphone controls", "Live captions", "Speaker identification"],
      result: "A working prototype of a call experience where sign and speech are treated as equally first-class ways to communicate."
    },
    {
      id: "retinal-ai",
      n: "03",
      name: "Retinal AI",
      image: "assets/proj_images/retiscan.png",
      category: "AI / Medical Imaging / Computer Vision (Academic / Technical)",
      summary: "An AI-assisted retinal image analysis system that enhances fundus images and assists with glaucoma classification. Built as a technical research project — not a diagnostic service.",
      tech: ["Python", "Real-ESRGAN", "PyTorch", "OpenCV", "Machine Learning", "Computer Vision"],
      links: { github: "#", demo: null },
      problem: "Fundus (retinal) images are often low-resolution or noisy, which makes downstream analysis — including glaucoma-relevant classification — less reliable.",
      approach: "Enhance the image first, measure whether the enhancement actually helped, then classify — rather than feeding raw images straight into a classifier.",
      build: "Uploaded fundus images pass through a Real-ESRGAN super-resolution model built on PyTorch, followed by OpenCV-based analysis. Enhancement quality is measured with PSNR, SSIM, MSE and a computed enhancement factor before the image is passed to a classification stage, with results compiled into a structured report alongside patient information.",
      features: ["Fundus image upload", "Image enhancement (Real-ESRGAN)", "Glaucoma-relevant classification", "Quality analysis: PSNR, SSIM, MSE", "Enhancement factor scoring", "Automated report generation", "Patient information management"],
      result: "A technical/academic system demonstrating an enhancement-then-classification pipeline for retinal imagery. It is not a diagnostic tool and does not replace a medical professional.",
      note: "Academic / technical project — not a certified medical device or diagnostic service."
    },

  ],

  faq: [
    { q: "What kind of websites do you build?", a: "Business websites, portfolios, landing pages, custom web applications and AI-powered digital products — whatever the idea actually needs." },
    { q: "Can you build from just an idea?", a: "Yes. You don't need a spec or a finished design — a rough idea is a fine starting point. We shape it together." },
    { q: "Do you design and develop?", a: "Yes. Structure and visual direction happen before development, so the build has something solid to follow." },
    { q: "How long does a project take?", a: "Depends on scope. A landing page and a full web application don't take the same time — we'll align on timeline once the scope is clear." },
    { q: "How much does it cost?", a: "Every project is different. Tell me what you want to build and I'll put together a quote based on the actual scope." }
  ],

  process: [
    { n: "01", title: "Discover", body: "We talk about your idea, audience, goals and what the website actually needs to accomplish." },
    { n: "02", title: "Design", body: "Structure, visual direction and user experience come first — before a line of code." },
    { n: "03", title: "Develop", body: "The design becomes a real, responsive, functional product." },
    { n: "04", title: "Launch", body: "Tested, optimized and deployed to a live domain." },
    { n: "05", title: "Support", body: "After launch, I'm around for updates, improvements and new features." }
  ]
};
