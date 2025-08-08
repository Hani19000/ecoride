document.addEventListener('DOMContentLoaded', function(){
    const roleChauffeur = document.getElementById('roleChauffeur');
    const chauffeurDetails = document.getElementById('chauffeurDetails');
    
    roleChauffeur.addEventListener('change', function(){
      if (roleChauffeur.checked) {
        chauffeurDetails.classList.remove('d-none');
      } else {
        chauffeurDetails.classList.add('d-none');
      }
    });
  });