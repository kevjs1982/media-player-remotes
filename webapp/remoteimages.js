 var maybeStartImageLoader = function(el, todo) {
    var img = el.querySelector('img');
    if (todo['extras'] && todo.extras.validImage && todo.extras.imageUrl) {
      if (todo.extras.imageUrl===PLACEHOLDER_IMAGE) {
        img.src = PLACEHOLDER_IMAGE;
        img.style.display = 'inline';
        window.loadImage(todo.extras.uri, function(blob_uri, requested_uri) {
          todo.extras.imageUrl = blob_uri;
          img.src = blob_uri;
        });
      } else {
        img.src = todo.extras.imageUrl;
        img.style.display = 'inline';
      }
    } else {
      img.style.display = 'none'; 
    }
  };