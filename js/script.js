/* ============================================================
   To-Do Lists Dashboard — JavaScript
   Single JS file for the entire app.
   Organized into sections: Storage helpers, Greeting, Timer,
   To-Do List, Quick Links, Theme.
   ============================================================ */

(function () {
    'use strict';

    /* ---------- Storage helpers ---------- */
    const Storage = {
        get(key, fallback) {
            try {
                const value = localStorage.getItem(key);
                return value ? JSON.parse(value) : fallback;
            } catch (e) {
                console.error('Storage read error:', e);
                return fallback;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.error('Storage write error:', e);
            }
        }
    };

    /* ---------- Element refs ---------- */
    const $ = (sel) => document.querySelector(sel);
    const els = {
        themeToggle: $('#themeToggle'),
        greetingText: $('#greetingText'),
        customName: $('#customName'),
        clock: $('#clock'),
        date: $('#date'),
        // Timer
        timerDisplay: $('#timerDisplay'),
        pomodoroDuration: $('#pomodoroDuration'),
        timerStart: $('#timerStart'),
        timerStop: $('#timerStop'),
        timerReset: $('#timerReset'),
        // To-do
        todoForm: $('#todoForm'),
        todoInput: $('#todoInput'),
        todoList: $('#todoList'),
        todoEmpty: $('#todoEmpty'),
        // Links
        linkForm: $('#linkForm'),
        linkName: $('#linkName'),
        linkUrl: $('#linkUrl'),
        linksList: $('#linksList'),
        linksEmpty: $('#linksEmpty')
    };

    /* ============================================================
       GREETING & CLOCK
       ============================================================ */
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

    function getGreeting(hour) {
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }

    function updateClock() {
        const now = new Date();
        const h = now.getHours();
        const min = String(now.getMinutes()).padStart(2, '0');
        const hr = String(h).padStart(2, '0');
        els.clock.textContent = `${hr}:${min}`;
        els.date.textContent = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

        const name = Storage.get('dashboard_name', '');
        const greeting = getGreeting(h);
        els.greetingText.textContent = name ? `${greeting},` : `${greeting}!`;
        els.customName.textContent = name || '';
    }

    function initNameEditing() {
        els.customName.addEventListener('click', function () {
            const name = window.prompt('What is your name?', Storage.get('dashboard_name', ''));
            if (name === null) return; // user cancelled
            const trimmed = name.trim();
            Storage.set('dashboard_name', trimmed);
            updateClock();
        });
    }

    /* ============================================================
       THEME (Light / Dark)
       ============================================================ */
    function initTheme() {
        const savedTheme = Storage.get('dashboard_theme', null);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        Storage.set('dashboard_theme', next);
    }

    /* ============================================================
       FOCUS TIMER (Pomodoro)
       ============================================================ */
    const Timer = {
        intervalId: null,
        totalSeconds: 25 * 60,
        remaining: 25 * 60,
        isRunning: false,

        init() {
            const savedDuration = Storage.get('dashboard_pomodoro', 25);
            this.setDuration(savedDuration);
            els.pomodoroDuration.value = savedDuration;
            this.render();

            els.timerStart.addEventListener('click', () => this.start());
            els.timerStop.addEventListener('click', () => this.stop());
            els.timerReset.addEventListener('click', () => this.reset());
            els.pomodoroDuration.addEventListener('change', (e) => {
                let val = parseInt(e.target.value, 10);
                if (isNaN(val) || val < 1) val = 1;
                if (val > 90) val = 90;
                e.target.value = val;
                this.setDuration(val);
                Storage.set('dashboard_pomodoro', val);
            });
        },

        setDuration(minutes) {
            this.totalSeconds = minutes * 60;
            if (!this.isRunning) {
                this.remaining = this.totalSeconds;
                this.render();
            }
        },

        start() {
            if (this.isRunning) return;
            if (this.remaining <= 0) this.remaining = this.totalSeconds;
            this.isRunning = true;
            els.timerDisplay.classList.add('is-running');
            els.timerStart.disabled = true;
            this.intervalId = setInterval(() => this.tick(), 1000);
        },

        stop() {
            if (!this.isRunning) return;
            this.isRunning = false;
            clearInterval(this.intervalId);
            els.timerDisplay.classList.remove('is-running');
            els.timerStart.disabled = false;
        },

        reset() {
            this.stop();
            this.remaining = this.totalSeconds;
            this.render();
        },

        tick() {
            this.remaining--;
            this.render();
            if (this.remaining <= 0) {
                this.stop();
                this.remaining = 0;
                this.onComplete();
            }
        },

        onComplete() {
            // Simple notification via page title flash + optional browser notify
            const originalTitle = document.title;
            let toggle = false;
            const flash = setInterval(() => {
                document.title = toggle ? '⏰ Time is up!' : originalTitle;
                toggle = !toggle;
            }, 800);
            setTimeout(() => {
                clearInterval(flash);
                document.title = originalTitle;
            }, 6000);

            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Focus Timer', { body: 'Your focus session is complete!' });
            }
        },

        render() {
            const m = String(Math.floor(this.remaining / 60)).padStart(2, '0');
            const s = String(this.remaining % 60).padStart(2, '0');
            els.timerDisplay.textContent = `${m}:${s}`;
        }
    };

    /* ============================================================
       TO-DO LIST
       ============================================================ */
    const Todo = {
        tasks: [],

        init() {
            this.tasks = Storage.get('dashboard_todos', []);
            els.todoForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.add(els.todoInput.value.trim());
                els.todoForm.reset();
            });
            this.render();
        },

        add(text) {
            if (!text) return;
            this.tasks.push({ id: Date.now(), text, done: false });
            this.save();
            this.render();
        },

        toggle(id) {
            const task = this.tasks.find(t => t.id === id);
            if (task) task.done = !task.done;
            this.save();
            this.render();
        },

        edit(id, newText) {
            const task = this.tasks.find(t => t.id === id);
            if (task && newText.trim()) task.text = newText.trim();
            this.save();
            this.render();
        },

        remove(id) {
            this.tasks = this.tasks.filter(t => t.id !== id);
            this.save();
            this.render();
        },

        save() {
            Storage.set('dashboard_todos', this.tasks);
        },

        render() {
            els.todoList.innerHTML = '';
            els.todoEmpty.style.display = this.tasks.length ? 'none' : 'block';

            this.tasks.forEach(task => {
                const li = document.createElement('li');
                li.className = 'todo__item' + (task.done ? ' is-done' : '');

                // Checkbox
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'todo__checkbox';
                checkbox.checked = task.done;
                checkbox.addEventListener('change', () => this.toggle(task.id));

                // Text (editable on double click)
                const span = document.createElement('span');
                span.className = 'todo__text';
                span.textContent = task.text;
                span.title = 'Double-click to edit';
                span.addEventListener('dblclick', () => this.startEdit(span, task.id));

                // Action buttons
                const actions = document.createElement('div');
                actions.className = 'todo__actions';

                const editBtn = document.createElement('button');
                editBtn.className = 'todo__btn';
                editBtn.innerHTML = '✏️';
                editBtn.title = 'Edit';
                editBtn.addEventListener('click', () => this.startEdit(span, task.id));

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'todo__btn todo__btn--delete';
                deleteBtn.innerHTML = '🗑️';
                deleteBtn.title = 'Delete';
                deleteBtn.addEventListener('click', () => this.remove(task.id));

                actions.appendChild(editBtn);
                actions.appendChild(deleteBtn);

                li.appendChild(checkbox);
                li.appendChild(span);
                li.appendChild(actions);
                els.todoList.appendChild(li);
            });
        },

        startEdit(span, id) {
            const oldText = span.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'todo__text';
            input.value = oldText;
            span.replaceWith(input);
            input.focus();
            input.select();

            const finish = () => {
                this.edit(id, input.value);
            };

            input.addEventListener('blur', finish);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') input.blur();
                if (e.key === 'Escape') { input.value = oldText; input.blur(); }
            });
        }
    };

    /* ============================================================
       QUICK LINKS
       ============================================================ */
    const Links = {
        links: [],

        init() {
            this.links = Storage.get('dashboard_links', []);
            els.linkForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.add(els.linkName.value.trim(), els.linkUrl.value.trim());
                els.linkForm.reset();
            });
            this.render();
        },

        add(name, url) {
            if (!name || !url) return;
            // Normalize URL to include protocol
            if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
            this.links.push({ id: Date.now(), name, url });
            this.save();
            this.render();
        },

        remove(id) {
            this.links = this.links.filter(l => l.id !== id);
            this.save();
            this.render();
        },

        save() {
            Storage.set('dashboard_links', this.links);
        },

        render() {
            els.linksList.innerHTML = '';
            els.linksEmpty.style.display = this.links.length ? 'none' : 'block';

            this.links.forEach(link => {
                const wrapper = document.createElement('span');
                wrapper.className = 'link__item';

                const anchor = document.createElement('a');
                anchor.className = 'link__name';
                anchor.href = link.url;
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
                anchor.textContent = link.name;

                const removeBtn = document.createElement('button');
                removeBtn.className = 'link__remove';
                removeBtn.innerHTML = '&times;';
                removeBtn.title = 'Remove';
                removeBtn.setAttribute('aria-label', 'Remove ' + link.name);
                removeBtn.addEventListener('click', () => this.remove(link.id));

                wrapper.appendChild(anchor);
                wrapper.appendChild(removeBtn);
                els.linksList.appendChild(wrapper);
            });
        }
    };

    /* ============================================================
       INITIALIZATION
       ============================================================ */
    function init() {
        initTheme();
        updateClock();
        setInterval(updateClock, 1000);
        initNameEditing();
        Timer.init();
        Todo.init();
        Links.init();

        els.themeToggle.addEventListener('click', toggleTheme);

        // Request notification permission politely (for timer completion)
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
