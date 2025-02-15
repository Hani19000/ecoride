document.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const formData = {
        username: document.getElementById("inputEmail4").value,
        password: document.getElementById("inputPassword4").value,
        nom: document.getElementById("exampleInputEmail1").value,
        prenom: document.getElementById("inputprénom").value,
        address: document.getElementById("inputAddress").value,
        departement: document.getElementById("inputAddress2").value,
        ville: document.getElementById("inputCity").value,
    };

    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });

        const data = await response.json();
        alert(data.message);
        if (response.ok) window.location.href = "/login";
    } catch (error) {
        console.error("Error:", error);
    }
});

document.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = {
        username: document.getElementById("inputEmail").value,
        password: document.getElementById("inputPassword").value,
    };

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });

        const data = await response.json();
        alert(data.message);
        if (response.ok) window.location.href = "/profile";  // Redirection après connexion
    } catch (error) {
        console.error("Error:", error);
    }
});


