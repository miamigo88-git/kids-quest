(function () {
  const MOODS = {
    sleepy: {
      message: "Let's start the day! 😺",
      color: '#D1D5DB',
      bodyColor: '#F3E8FF'
    },
    sad: {
      message: 'You can do it! Let\'s try!',
      color: '#FCA5A5',
      bodyColor: '#FEF3F2'
    },
    neutral: {
      message: 'Good start! Keep going!',
      color: '#FDE68A',
      bodyColor: '#FFFBEB'
    },
    content: {
      message: 'Yay! Halfway there!',
      color: '#FBBF24',
      bodyColor: '#FEF3C7'
    },
    happy: {
      message: 'Awesome job! Almost done!',
      color: '#34D399',
      bodyColor: '#ECFDF5'
    },
    ecstatic: {
      message: 'PURRFECT! All done!! 🎉',
      color: '#F472B6',
      bodyColor: '#FCE7F3'
    }
  };

  function catSVG(mood) {
    const m = MOODS[mood] || MOODS.neutral;
    const body = m.bodyColor;
    const accent = m.color;

    let eyes = '';
    let mouth = '';
    let extras = '';
    let cheeks = '';

    if (mood === 'sleepy') {
      eyes = `
        <path d="M 70 110 Q 80 115 90 110" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M 130 110 Q 140 115 150 110" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/>
      `;
      mouth = `<path d="M 105 135 Q 110 138 115 135" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
      extras = `<text x="155" y="90" font-size="18" font-weight="bold" fill="#A78BFA">z</text>
                <text x="165" y="78" font-size="14" font-weight="bold" fill="#A78BFA">z</text>`;
    } else if (mood === 'sad') {
      eyes = `
        <ellipse cx="80" cy="110" rx="5" ry="6" fill="#333"/>
        <ellipse cx="140" cy="110" rx="5" ry="6" fill="#333"/>
        <circle cx="78" cy="108" r="1.5" fill="white"/>
        <circle cx="138" cy="108" r="1.5" fill="white"/>
      `;
      mouth = `<path d="M 100 140 Q 110 132 120 140" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      extras = `<path d="M 80 122 Q 78 130 76 134" stroke="#60A5FA" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    } else if (mood === 'neutral') {
      eyes = `
        <ellipse cx="80" cy="110" rx="5" ry="7" fill="#333"/>
        <ellipse cx="140" cy="110" rx="5" ry="7" fill="#333"/>
        <circle cx="78" cy="108" r="2" fill="white"/>
        <circle cx="138" cy="108" r="2" fill="white"/>
      `;
      mouth = `<line x1="100" y1="135" x2="120" y2="135" stroke="#333" stroke-width="2.5" stroke-linecap="round"/>`;
    } else if (mood === 'content') {
      eyes = `
        <path d="M 70 108 Q 80 116 90 108" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M 130 108 Q 140 116 150 108" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/>
      `;
      mouth = `<path d="M 100 132 Q 110 142 120 132" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      cheeks = `
        <ellipse cx="65" cy="128" rx="8" ry="5" fill="#FBA5C3" opacity="0.6"/>
        <ellipse cx="155" cy="128" rx="8" ry="5" fill="#FBA5C3" opacity="0.6"/>
      `;
    } else if (mood === 'happy') {
      eyes = `
        <path d="M 68 112 Q 80 102 92 112" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M 128 112 Q 140 102 152 112" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/>
      `;
      mouth = `<path d="M 95 130 Q 110 148 125 130" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/>
               <path d="M 98 133 Q 110 142 122 133 L 122 134 Q 110 144 98 134 Z" fill="#FB7185"/>`;
      cheeks = `
        <circle cx="62" cy="130" r="9" fill="#FBA5C3" opacity="0.7"/>
        <circle cx="158" cy="130" r="9" fill="#FBA5C3" opacity="0.7"/>
      `;
    } else if (mood === 'ecstatic') {
      eyes = `
        <path d="M 68 105 L 76 115 M 76 105 L 68 115" stroke="#333" stroke-width="3" stroke-linecap="round"/>
        <path d="M 84 105 L 92 115 M 92 105 L 84 115" stroke="#333" stroke-width="3" stroke-linecap="round"/>
        <path d="M 128 105 L 136 115 M 136 105 L 128 115" stroke="#333" stroke-width="3" stroke-linecap="round"/>
        <path d="M 144 105 L 152 115 M 152 105 L 144 115" stroke="#333" stroke-width="3" stroke-linecap="round"/>
      `;
      mouth = `<path d="M 92 128 Q 110 152 128 128 Q 110 144 92 128 Z" fill="#FB7185" stroke="#333" stroke-width="2"/>
               <path d="M 100 138 Q 110 145 120 138" stroke="#fff" stroke-width="2" fill="none"/>`;
      cheeks = `
        <circle cx="62" cy="132" r="10" fill="#F472B6" opacity="0.7"/>
        <circle cx="158" cy="132" r="10" fill="#F472B6" opacity="0.7"/>
      `;
      extras = `
        <text x="40" y="50" font-size="20">⭐</text>
        <text x="160" y="55" font-size="16">✨</text>
        <text x="30" y="100" font-size="14">✨</text>
        <text x="175" y="100" font-size="20">⭐</text>
      `;
    }

    return `
      <svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
        <!-- Tail -->
        <path d="M 170 165 Q 200 150 195 120 Q 192 105 180 110" stroke="#333" stroke-width="3" fill="${body}" stroke-linejoin="round"/>
        <!-- Body -->
        <ellipse cx="110" cy="165" rx="55" ry="40" fill="${body}" stroke="#333" stroke-width="3"/>
        <!-- Feet -->
        <ellipse cx="85" cy="195" rx="14" ry="8" fill="${body}" stroke="#333" stroke-width="3"/>
        <ellipse cx="135" cy="195" rx="14" ry="8" fill="${body}" stroke="#333" stroke-width="3"/>
        <!-- Head -->
        <circle cx="110" cy="110" r="55" fill="${body}" stroke="#333" stroke-width="3"/>
        <!-- Ears -->
        <path d="M 65 75 L 55 35 L 88 65 Z" fill="${body}" stroke="#333" stroke-width="3" stroke-linejoin="round"/>
        <path d="M 155 75 L 165 35 L 132 65 Z" fill="${body}" stroke="#333" stroke-width="3" stroke-linejoin="round"/>
        <!-- Inner ears -->
        <path d="M 68 68 L 62 45 L 80 62 Z" fill="${accent}" opacity="0.7"/>
        <path d="M 152 68 L 158 45 L 140 62 Z" fill="${accent}" opacity="0.7"/>
        <!-- Stripes on head -->
        <path d="M 90 70 Q 92 75 90 80" stroke="${accent}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.5"/>
        <path d="M 100 65 Q 102 72 100 78" stroke="${accent}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.5"/>
        <path d="M 130 70 Q 128 75 130 80" stroke="${accent}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.5"/>
        <path d="M 120 65 Q 118 72 120 78" stroke="${accent}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.5"/>
        <!-- Cheeks -->
        ${cheeks}
        <!-- Eyes -->
        ${eyes}
        <!-- Nose -->
        <path d="M 105 122 L 115 122 L 110 128 Z" fill="#FB7185" stroke="#333" stroke-width="1.5" stroke-linejoin="round"/>
        <!-- Mouth -->
        ${mouth}
        <!-- Whiskers -->
        <line x1="50" y1="125" x2="80" y2="128" stroke="#333" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="50" y1="135" x2="80" y2="133" stroke="#333" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="170" y1="125" x2="140" y2="128" stroke="#333" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="170" y1="135" x2="140" y2="133" stroke="#333" stroke-width="1.5" stroke-linecap="round"/>
        <!-- Extras -->
        ${extras}
      </svg>
    `;
  }

  function moodFor(rate, totalTasks) {
    if (totalTasks === 0) return 'sleepy';
    if (rate >= 1.0) return 'ecstatic';
    if (rate >= 0.8) return 'happy';
    if (rate >= 0.5) return 'content';
    if (rate >= 0.25) return 'neutral';
    if (rate > 0) return 'sad';
    return 'sleepy';
  }

  function messageFor(mood, completed, total) {
    const msgs = {
      sleepy: total === 0 ? 'No quests yet. Ask your parent!' : "Let's start! You got this!",
      sad: `Just ${total - completed} more to go!`,
      neutral: `Nice start! ${completed} of ${total} done!`,
      content: `Halfway! ${total - completed} left!`,
      happy: `Almost there! ${total - completed} more!`,
      ecstatic: `PURRFECT! All ${total} done! 🎉`
    };
    return msgs[mood];
  }

  window.CatMascot = {
    render(container, mood) {
      container.innerHTML = catSVG(mood);
    },
    celebrate(container) {
      container.classList.add('celebrate');
      setTimeout(() => container.classList.remove('celebrate'), 1000);
    },
    moodFor,
    messageFor
  };
})();
