// Carousel state management
const carouselState = {
    experience: 0,
    education: 0,
    projects: 0
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initDots();
    updateArrows('experience', document.querySelectorAll('#experience .carousel-slide').length);
    updateArrows('education', document.querySelectorAll('#education .carousel-slide').length);
    updateArrows('projects', document.querySelectorAll('#projects .carousel-slide').length);
});

// Open tab function
function openTab(tabName) {
    // Hide all tab content
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Remove active class from all tab buttons
    const buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
    
    // Initialize dots for carousel tabs
    if (tabName === 'experience' || tabName === 'education' || tabName === 'projects') {
        initDots();
        const slides = document.querySelectorAll(`#${tabName} .carousel-slide`);
        updateArrows(tabName, slides.length);
    }
}

// Initialize dot navigation for each carousel
function initDots() {
    ['experience', 'education', 'projects'].forEach(tab => {
        const slides = document.querySelectorAll(`#${tab} .carousel-slide`);
        const dotsContainer = document.getElementById(`${tab}-dots`);
        if (dotsContainer && slides.length > 1) {
            dotsContainer.innerHTML = '';
            for (let i = 0; i < slides.length; i++) {
                const dot = document.createElement('div');
                dot.className = i === 0 ? 'dot active' : 'dot';
                dot.onclick = () => goToSlide(tab, i);
                dotsContainer.appendChild(dot);
            }
        }
    });
}

// Go to specific slide
function goToSlide(tab, index) {
    const slides = document.querySelectorAll(`#${tab} .carousel-slide`);
    const dots = document.querySelectorAll(`#${tab}-dots .dot`);
    
    // Remove active class from current slide and dot
    slides[carouselState[tab]].classList.remove('active');
    if (dots.length > 0) {
        dots[carouselState[tab]].classList.remove('active');
    }
    
    // Set new index
    carouselState[tab] = index;
    
    // Add active class to new slide and dot
    slides[carouselState[tab]].classList.add('active');
    if (dots.length > 0) {
        dots[carouselState[tab]].classList.add('active');
    }
    
    // Update arrow states
    updateArrows(tab, slides.length);
}

// Change slide
function changeSlide(tab, direction) {
    const slides = document.querySelectorAll(`#${tab} .carousel-slide`);
    const dots = document.querySelectorAll(`#${tab}-dots .dot`);
    
    // Remove active class from current slide
    slides[carouselState[tab]].classList.remove('active');
    if (dots.length > 0) {
        dots[carouselState[tab]].classList.remove('active');
    }
    
    // Calculate new index
    carouselState[tab] = (carouselState[tab] + direction + slides.length) % slides.length;
    
    // Add active class to new slide
    slides[carouselState[tab]].classList.add('active');
    if (dots.length > 0) {
        dots[carouselState[tab]].classList.add('active');
    }
    
    // Update arrow states
    updateArrows(tab, slides.length);
}

// Update arrow visibility based on slide position
function updateArrows(tab, totalSlides) {
    const prevBtn = document.querySelector(`#${tab} .nav-arrow.prev`);
    const nextBtn = document.querySelector(`#${tab} .nav-arrow.next`);
    
    if (prevBtn && nextBtn) {
        // For single slide, disable both arrows
        if (totalSlides <= 1) {
            prevBtn.disabled = true;
            nextBtn.disabled = true;
        } else {
            // Enable both for carousel navigation
            prevBtn.disabled = false;
            nextBtn.disabled = false;
        }
    }
}