class FootprintLogger {
    constructor() {
        this.token = localStorage.getItem("token");
        this.user = JSON.parse(localStorage.getItem("user") || "null");
        this.charts = {}; // store chart instances so i can destroy them later
        this.activityData = {};
        this.init();
    }

    init() {
        // set up event listeners, there's probably a cleaner way to do this, i'll look into it later!!
        // todo: refactor this
        let loginTab = document.getElementById("login-tab");
        if (loginTab) {
            loginTab.addEventListener("click", () => {
                document.getElementById("login-form").style.display = "block";
                document.getElementById("register-form").style.display = "none";
            });
        }

        let registerTab = document.getElementById("register-tab");
        if (registerTab) {
            registerTab.addEventListener("click", () => {
                document.getElementById("register-form").style.display = "block";
                document.getElementById("login-form").style.display = "none";
            });
        }

        let loginForm = document.getElementById("login-form");
        if (loginForm) {
            loginForm.addEventListener("submit", (e) => this.handleLogin(e));
        }

        let registerForm = document.getElementById("register-form");
        if (registerForm) {
            registerForm.addEventListener("submit", (e) => this.handleRegister(e));
        }

        let logoutBtn = document.getElementById("logout-btn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", () => this.logout());
        }

        let activityForm = document.getElementById("activity-form");
        if (activityForm) {
            activityForm.addEventListener("submit", (e) => this.handleAddActivity(e));
        }

        let categorySelect = document.getElementById("category");
        if (categorySelect) {
            categorySelect.addEventListener("change", () => this.updateActivityOptions());
        }

        let filterCategory = document.getElementById("filter-category");
        if (filterCategory) {
            filterCategory.addEventListener("change", () => this.loadActivities());
        }

        let leaderboardPeriod = document.getElementById("leaderboard-period");
        if (leaderboardPeriod) {
            leaderboardPeriod.addEventListener("change", () => this.loadLeaderboard());
        }

        // check if user is already logged in
        if (this.token && this.user) {
            document.getElementById("auth-section").style.display = "none";
            document.getElementById("app-section").style.display = "block";
            document.getElementById("user-info").style.display = "block";
            document.getElementById("logout-btn").style.display = "block";
            document.getElementById("user-info").textContent = "Welcome, " + this.user.username + "!";
            this.loadDashboard();
        } else {
            document.getElementById("auth-section").style.display = "block";
            document.getElementById("app-section").style.display = "none";
        }

        this.loadActivityData();
    }

    async handleLogin(e) {
        e.preventDefault(); 
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;

        console.log("Attempting to log in...");

        try {
            // login request
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok) {
                // save token and user info to localStorage
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem("token", this.token);
                localStorage.setItem("user", JSON.stringify(this.user));

                this.showMessage("Login successful!", "success");
                location.reload(); // reload page to show app
            } else {
                this.showMessage(data.error, "error");
            }

        } catch (err) {
            console.error("Login error:", err);
            this.showMessage("Network error occurred", "error");
        }
    }

    async handleRegister(e) {
        e.preventDefault();

        const username = document.getElementById("register-username").value;
        const email = document.getElementById("register-email").value;
        const password = document.getElementById("register-password").value;

        console.log("Creating new user account...");

        try {
            // send registration request
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password })
            });

            const data = await res.json();

            if (res.ok) {
                // automatically log in the user after registration
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem("token", this.token);
                localStorage.setItem("user", JSON.stringify(this.user));

                this.showMessage("Registration successful!", "success");
                location.reload();
            } else {
                this.showMessage(data.error, "error");
            }

        } catch (err) {
            console.error("Registration error:", err);
            this.showMessage("Network error occurred", "error");
        }
    }

    logout() {
        // clear stored user data
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        this.showMessage("Logged out successfully", "success");
        location.reload(); 
    }

    async loadActivityData() {
        try {
            let res = await fetch("/api/activities/categories");
            let data = await res.json();
            this.activityData = data;
        } catch (err) {
            console.error("Couldn't load activity categories:", err);
        }
    }

    // update the activity dropdown when category changes
    updateActivityOptions() {
        let category = document.getElementById("category").value;
        let activitySelect = document.getElementById("activity");
        activitySelect.innerHTML = "<option value=''>Select activity</option>";

        if (this.activityData[category]) {
            // populate dropdown with activities for selected category
            for (let key in this.activityData[category]) {
                let option = document.createElement("option");
                option.value = key;
                option.textContent = this.activityData[category][key].text;
                activitySelect.appendChild(option);
            }
        }
    }

    async handleAddActivity(e) {
        e.preventDefault();
        let category = document.getElementById("category").value;
        let activity = document.getElementById("activity").value;
        
        if (!category || !activity) {
            this.showMessage("Please select both category and activity", "error");
            return;
        }

        try {
            let res = await fetch("/api/activities", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + this.token
                },
                body: JSON.stringify({category, activity})
            });
            
            let data = await res.json();
            
            if (res.ok) {
                this.showMessage("Activity added successfully!", "success");
                document.getElementById("activity-form").reset();
                this.loadDashboard(); // refresh dashboard data
            } else {
                this.showMessage(data.error, "error");
            }
        } catch (err) {
            console.error("Error adding activity:", err);
            this.showMessage("Failed to add activity", "error");
        }
    }

    async loadDashboard() {
        try {
            let res = await fetch("/api/dashboard", {
                headers: {"Authorization": "Bearer " + this.token}
            });
            let data = await res.json();
            
            if (res.ok) {
                // update dashboard stats
                document.getElementById("total-emissions").textContent = data.totalEmissions.toFixed(2) + " kg CO2";
                document.getElementById("weekly-emissions").textContent = data.weeklyEmissions.toFixed(2) + " kg CO2";
                document.getElementById("community-average").textContent = data.communityAverage.toFixed(2) + " kg CO2";
                document.getElementById("user-rank").textContent = "#" + data.userRank;

                // create emissions breakdown chart
                this.createChart("emissions-chart", Object.keys(data.emissionsByCategory), Object.values(data.emissionsByCategory));
                
                // load other dashboard components
                this.loadActivities();
                this.loadWeeklySummary();
                this.loadStreak();
                this.loadLeaderboard();
            }
        } catch (err) {
            console.error("Dashboard loading error:", err);
        }
    }

    // create charts using Chart.js, had issues with chart not updating properly before
    // todo: go do this on FootProntLogger Part 1
    createChart(canvasId, labels, values) {
        const canvas = document.getElementById(canvasId);

        // destroy existing chart to prevent weird growing
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
            this.charts[canvasId] = null;
        }

        // this is a hack to fix chart canvas size issue(works!! Don't touch!)
        const newCanvas = canvas.cloneNode(true);
        canvas.parentNode.replaceChild(newCanvas, canvas);
        const ctx = newCanvas.getContext("2d");

        this.charts[canvasId] = new Chart(ctx, {
            type: canvasId === "weekly-chart" ? "line" : "doughnut",
            data: {
                labels,
                datasets: [{
                    data: values,
                    borderColor: "#2c5530",
                    backgroundColor: [
                        "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"
                    ]
                }]
            }
        });
    }

    async loadActivities() {
        const category = document.getElementById('filter-category').value;
        
        try {
            const url = category ? `/api/activities?category=${category}` : '/api/activities';
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            const data = await response.json();

            if (response.ok) {
                this.displayActivities(data.activities);
            }
        } catch (error) {
            console.error('Error loading activities:', error);
        }
    }

    displayActivities(activities) {
        const container = document.getElementById('activities-list');
        container.innerHTML = '';

        if (activities.length === 0) {
            container.innerHTML = '<p>No activities found.</p>';
            return;
        }

        // create activity items
        activities.forEach(activity => {
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <div class="activity-info">
                    <div>${activity.activityText}</div>
                    <div class="activity-date">${new Date(activity.date).toLocaleDateString()}</div>
                </div>
                <div>
                    <span>${activity.co2} kg CO2</span>
                    <button class="btn btn-danger" onclick="app.deleteActivity('${activity._id}')">Delete</button>
                </div>
            `;
            container.appendChild(item);
        });
    }

    async deleteActivity(id) {
        try {
            const res = await fetch(`/api/activities/${id}`, {
                method: "DELETE",
                headers: {
                    "Authorization": "Bearer " + this.token
                }
            });

            if (res.ok) {
                this.showMessage("Activity deleted!", "success");
                this.loadDashboard(); // refresh everything
            } else {
                this.showMessage("Failed to delete activity", "error");
            }
        } catch (err) {
            console.error("Delete error:", err);
            this.showMessage("Something went wrong", "error");
        }
    }

    //not working, idk why!!
    //todo: gonna come back to fix this!!
    async loadWeeklySummary() {
        try {
            let res = await fetch("/api/dashboard/weekly", {
                headers: {"Authorization": "Bearer " + this.token}
            });
            let data = await res.json();
            if (res.ok) {
                // create weekly trend chart
                this.createChart("weekly-chart", data.map(w => "Week " + w._id.week), data.map(w => w.total));
            }
        } catch (err) {
            console.error("Weekly summary error:", err);
        }
    }

    //works fine, dont touch!!
    async loadStreak() {
        try {
            let res = await fetch("/api/dashboard/streak", {
                headers: {"Authorization": "Bearer " + this.token}
            });
            let data = await res.json();
            if (res.ok) {
                document.getElementById("current-streak").textContent = data.currentStreak;
                document.getElementById("longest-streak").textContent = data.longestStreak;
            }
        } catch (err) {
            console.error("Streak loading error:", err);
        }
    }

    //finally works!! Dont't touch!!
    async loadLeaderboard() {
        let period = document.getElementById("leaderboard-period").value;
        try {
            let res = await fetch("/api/dashboard/leaderboard?period=" + period, {
                headers: {"Authorization": "Bearer " + this.token}
            });
            let data = await res.json();
            if (res.ok) {
                let container = document.getElementById("leaderboard-list");
                container.innerHTML = "";
                
                // build leaderboard list
                data.forEach((user, index) => {
                    let div = document.createElement("div");
                    div.textContent = "#" + (index + 1) + " " + user.username + " - " + user.totalEmissions.toFixed(2) + " kg CO2";
                    container.appendChild(div);
                });
            }
        } catch (err) {
            console.error("Leaderboard error:", err);
        }
    }

    // show notification to user 
    // todo: gotta check if this works on frontend!!
    showMessage(msg, type) {
        let messageEl = document.getElementById("message");
        messageEl.textContent = msg;
        messageEl.className = "message " + type;
        messageEl.style.display = "block";
        
        setTimeout(() => {
            messageEl.style.display = "none";
        }, 3000);
    }
}

const app = new FootprintLogger();