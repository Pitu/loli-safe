/* eslint-disable no-unused-expressions */
/* global swal, axios */

let panel = {}

panel.page
panel.username
panel.token = localStorage.token
panel.filesView = localStorage.filesView

panel.preparePage = function () {
  if (!panel.token) {
    window.location = 'auth'
  }
  panel.verifyToken(panel.token, true)
}

panel.verifyToken = function (token, reloadOnError) {
  if (reloadOnError === undefined) {
    reloadOnError = false
  }

  axios.post('api/tokens/verify', {
    token: token
  })
    .then(function (response) {
      if (response.data.success === false) {
        swal({
          title: 'An error occurred',
          text: response.data.description,
          icon: 'error'
        }).then(() => {
          if (reloadOnError) {
            localStorage.removeItem('token')
            location.location = 'auth'
          }
        })
        return
      }

      axios.defaults.headers.common.token = token
      localStorage.token = token
      panel.token = token
      panel.username = response.data.username
      return panel.prepareDashboard()
    })
    .catch(function (error) {
      console.log(error)
      return swal('An error occurred', 'There was an error with the request, please check the console for more information.', 'error')
    })
}

panel.prepareDashboard = function () {
  panel.page = document.getElementById('page')
  document.getElementById('auth').style.display = 'none'
  document.getElementById('dashboard').style.display = 'block'

  document.getElementById('itemUploads').addEventListener('click', function () {
    panel.setActiveMenu(this)
  })

  document.getElementById('itemManageGallery').addEventListener('click', function () {
    panel.setActiveMenu(this)
  })

  document.getElementById('itemTokens').addEventListener('click', function () {
    panel.setActiveMenu(this)
  })

  document.getElementById('itemPassword').addEventListener('click', function () {
    panel.setActiveMenu(this)
  })

  document.getElementById('itemLogout').innerHTML = `Logout ( ${panel.username} )`

  panel.getAlbumsSidebar()
}

panel.logout = function () {
  localStorage.removeItem('token')
  location.reload('.')
}

panel.getUploads = function (album = undefined, page = undefined) {
  if (page === undefined) page = 0

  let url = 'api/uploads/' + page
  if (album !== undefined) { url = 'api/album/' + album + '/' + page }

  axios.get(url).then(function (response) {
    if (response.data.success === false) {
      if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
      else return swal('An error occurred', response.data.description, 'error')
    }

    var prevPage = 0
    var nextPage = page + 1

    if (response.data.files.length < 25) { nextPage = page }

    if (page > 0) prevPage = page - 1

    var pagination = `
      <nav class="pagination is-centered">
        <a class="pagination-previous" onclick="panel.getUploads(${album}, ${prevPage} )">Previous</a>
        <a class="pagination-next" onclick="panel.getUploads(${album}, ${nextPage} )">Next page</a>
      </nav>
    `
    var listType = `
      <div class="columns">
        <div class="column">
          <a class="button is-small is-outlined is-danger" title="List view" onclick="panel.setFilesView('list', ${album}, ${page})">
            <span class="icon is-small">
              <i class="fa icon-list-bullet"></i>
            </span>
          </a>
          <a class="button is-small is-outlined is-danger" title="List view" onclick="panel.setFilesView('thumbs', ${album}, ${page})">
            <span class="icon is-small">
              <i class="fa icon-th-large"></i>
            </span>
          </a>
        </div>
      </div>
    `

    var table, item
    if (panel.filesView === 'thumbs') {
      panel.page.innerHTML = `
        ${pagination}
        <hr>
        ${listType}
        <div class="columns is-multiline is-mobile is-centered" id="table">

        </div>
        ${pagination}
      `

      table = document.getElementById('table')

      for (item of response.data.files) {
        var div = document.createElement('div')
        div.className = 'column is-narrow'
        if (item.thumb !== undefined) {
          div.innerHTML = `<a href="${item.file}" target="_blank"><img src="${item.thumb}"/></a>`
        } else {
          div.innerHTML = `<a href="${item.file}" target="_blank"><h1 class="title">.${item.file.split('.').pop()}</h1></a>`
        }
        table.appendChild(div)
      }
    } else {
      var albumOrUser = 'Album'
      if (panel.username === 'root') { albumOrUser = 'User' }

      panel.page.innerHTML = `
        ${pagination}
        <hr>
        ${listType}
        <div class="table-container">
          <table class="table is-narrow is-fullwidth is-hoverable">
            <thead>
              <tr>
                  <th>File</th>
                  <th>${albumOrUser}</th>
                  <th>Date</th>
                  <th></th>
              </tr>
            </thead>
            <tbody id="table">
            </tbody>
          </table>
        </div>
        <hr>
        ${pagination}
      `

      table = document.getElementById('table')

      for (item of response.data.files) {
        var tr = document.createElement('tr')

        var displayAlbumOrUser = item.album
        console.log(item)
        if (panel.username === 'root') {
          displayAlbumOrUser = ''
          if (item.username !== undefined) { displayAlbumOrUser = item.username }
        }

        tr.innerHTML = `
          <tr>
            <th><a href="${item.file}" target="_blank">${item.file}</a></th>
            <th>${displayAlbumOrUser}</th>
            <td>${item.date}</td>
            <td>
              <a class="button is-small is-danger is-outlined" title="Delete album" onclick="panel.deleteFile(${item.id})">
                <span class="icon is-small">
                  <i class="fa icon-trash"></i>
                </span>
              </a>
            </td>
          </tr>
        `

        table.appendChild(tr)
      }
    }
  })
    .catch(function (error) {
      console.log(error)
      return swal('An error occurred', 'There was an error with the request, please check the console for more information.', 'error')
    })
}

panel.setFilesView = function (view, album, page) {
  localStorage.filesView = view
  panel.filesView = view
  panel.getUploads(album, page)
}

panel.deleteFile = function (id) {
  swal({
    title: 'Are you sure?',
    text: 'You wont be able to recover the file!',
    icon: 'warning',
    dangerMode: true,
    buttons: {
      cancel: true,
      confirm: {
        text: 'Yes, delete it!',
        closeModal: false
      }
    }
  }).then(value => {
    if (!value) return
    axios.post('api/upload/delete', {
      id: id
    })
      .then(function (response) {
        if (response.data.success === false) {
          if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
          else return swal('An error occurred', response.data.description, 'error')
        }

        swal('Deleted!', 'The file has been deleted.', 'success')
        panel.getUploads()
      })
      .catch(function (error) {
        console.log(error)
        return swal('An error occurred', 'There was an error with the request, please check the console for more information.', 'error')
      })
  })
}

panel.getAlbums = function () {
  axios.get('api/albums').then(function (response) {
    if (response.data.success === false) {
      if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
      else return swal('An error occurred', response.data.description, 'error')
    }

    panel.page.innerHTML = `
      <h2 class="subtitle">Create new album</h2>

      <div class="field has-addons has-addons-centered">
        <div class="control is-expanded">
          <input id="albumName" class="input" type="text" placeholder="Name">
        </div>
        <div class="control">
          <a id="submitAlbum" class="button is-primary">Submit</a>
        </div>
      </div>

      <h2 class="subtitle">List of albums</h2>

      <div class="table-container">
        <table class="table is-narrow is-fullwidth is-hoverable">
          <thead>
            <tr>
                <th>Name</th>
                <th>Files</th>
                <th>Created At</th>
                <th>Public link</th>
                <th></th>
            </tr>
          </thead>
          <tbody id="table">
          </tbody>
        </table>
      </div>
    `

    var table = document.getElementById('table')

    for (var item of response.data.albums) {
      var tr = document.createElement('tr')
      tr.innerHTML = `
        <tr>
          <th>${item.name}</th>
          <th>${item.files}</th>
          <td>${item.date}</td>
          <td><a href="${item.identifier}" target="_blank">${item.identifier}</a></td>
          <td>
            <a class="button is-small is-primary is-outlined" title="Edit name" onclick="panel.renameAlbum(${item.id})">
              <span class="icon is-small">
                <i class="fa icon-pencil"></i>
              </span>
            </a>
            <a class="button is-small is-danger is-outlined" title="Delete album" onclick="panel.deleteAlbum(${item.id})">
              <span class="icon is-small">
                <i class="fa icon-trash"></i>
              </span>
            </a>
          </td>
        </tr>
      `

      table.appendChild(tr)
    }

    document.getElementById('submitAlbum').addEventListener('click', function () {
      panel.submitAlbum()
    })
  })
    .catch(function (error) {
      console.log(error)
      return swal('An error occurred', 'There was an error with the request, please check the console for more information.', 'error')
    })
}

panel.renameAlbum = function (id) {
  swal({
    title: 'Rename album',
    text: 'New name you want to give the album:',
    icon: 'info',
    content: {
      element: 'input',
      attributes: {
        placeholder: 'My super album'
      }
    },
    buttons: {
      cancel: true,
      confirm: {
        closeModal: false
      }
    }
  }).then(value => {
    if (!value) return swal.close()
    axios.post('api/albums/rename', {
      id: id,
      name: value
    })
      .then(function (response) {
        if (response.data.success === false) {
          if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
          else if (response.data.description === 'Name already in use') swal.showInputError('That name is already in use!')
          else swal('An error occurred', response.data.description, 'error')
          return
        }

        swal('Success!', 'Your album was renamed to: ' + value, 'success')
        panel.getAlbumsSidebar()
        panel.getAlbums()
      })
      .catch(function (error) {
        console.log(error)
        return swal('An error occurred', 'There was an error with the request, please check the console for more information.', 'error')
      })
  })
}

panel.deleteAlbum = function (id) {
  swal({
    title: 'Are you sure?',
    text: 'This won\'t delete your files, only the album!',
    icon: 'warning',
    dangerMode: true,
    buttons: {
      cancel: true,
      confirm: {
        text: 'Yes, delete it!',
        closeModal: false
      }
    }
  }).then(value => {
    if (!value) return
    axios.post('api/albums/delete', {
      id: id
    })
      .then(function (response) {
        if (response.data.success === false) {
          if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
          else return swal('An error occurred', response.data.description, 'error')
        }

        swal('Deleted!', 'Your album has been deleted.', 'success')
        panel.getAlbumsSidebar()
        panel.getAlbums()
      })
      .catch(function (error) {
        console.log(error)
        return swal('An error occurred', 'There was an error with the request, please check the console for more information.', 'error')
      })
  })
}

panel.submitAlbum = function () {
  axios.post('api/albums', {
    name: document.getElementById('albumName').value
  })
    .then(function (response) {
      if (response.data.success === false) {
        if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
        else return swal('An error occurred', response.data.description, 'error')
      }

      swal('Woohoo!', 'Album was added successfully', 'success')
      panel.getAlbumsSidebar()
      panel.getAlbums()
    })
    .catch(function (error) {
      console.log(error)
      return swal('An error occurred', 'There was an error with the request, please check the console for more information.', 'error')
    })
}

panel.getAlbumsSidebar = function () {
  axios.get('api/albums/sidebar')
    .then(function (response) {
      if (response.data.success === false) {
        if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
        else return swal('An error occurred', response.data.description, 'error')
      }

      var albumsContainer = document.getElementById('albumsContainer')
      albumsContainer.innerHTML = ''

      if (response.data.albums === undefined) return

      var li, a
      for (var album of response.data.albums) {
        li = document.createElement('li')
        a = document.createElement('a')
        a.id = album.id
        a.innerHTML = album.name

        a.addEventListener('click', function () {
          panel.getAlbum(this)
        })

        li.appendChild(a)
        albumsContainer.appendChild(li)
      }
    })
    .catch(function (error) {
      console.log(error)
      return swal('An error occurred', 'There was an error with the request, please check the console for more information.', 'error')
    })
}

panel.getAlbum = function (item) {
  panel.setActiveMenu(item)
  panel.getUploads(item.id)
}

panel.changeToken = function () {
  axios.get('api/tokens')
    .then(function (response) {
      if (response.data.success === false) {
        if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
        else return swal('An error occurred', response.data.description, 'error')
      }

      panel.page.innerHTML = `
        <h2 class="subtitle">Manage your token</h2>

        <div class="field">
          <label class="label">Your current token:</label>
          <div class="field has-addons">
            <div class="control is-expanded">
              <input id="token" readonly class="input" type="text" placeholder="Your token" value="${response.data.token}">
            </div>
            <div class="control">
              <a id="getNewToken" class="button is-primary">Request new token</a>
            </div>
          </div>
        </div>
      `

      document.getElementById('getNewToken').addEventListener('click', function () {
        panel.getNewToken()
      })
    })
    .catch(function (error) {
      console.log(error)
      return swal('An error occurred', 'There was an error with the request, please check the console for more information.', 'error')
    })
}

panel.getNewToken = function () {
  axios.post('api/tokens/change')
    .then(function (response) {
      if (response.data.success === false) {
        if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
        else return swal('An error occurred', response.data.description, 'error')
      }

      swal({
        title: 'Woohoo!',
        text: 'Your token was changed successfully.',
        icon: 'success'
      }).then(() => {
        localStorage.token = response.data.token
        location.reload()
      })
    })
    .catch(function (error) {
      console.log(error)
      return swal('An error occurred', 'There was an error with the request, please check the console for more information.', 'error')
    })
}

panel.changePassword = function () {
  panel.page.innerHTML = `
    <h2 class="subtitle">Change your password</h2>

    <div class="field">
      <label class="label">New password:</label>
      <div class="control">
        <input id="password" class="input" type="password" placeholder="Your new password">
      </div>
    </div>
    <div class="field">
      <label class="label">Confirm password:</label>
      <div class="field has-addons">
        <div class="control is-expanded">
          <input id="passwordConfirm" class="input is-expanded" type="password" placeholder="Verify your new password">
        </div>
        <div class="control">
          <a id="sendChangePassword" class="button is-primary">Set new password</a>
        </div>
      </div>
    </div>
  `

  document.getElementById('sendChangePassword').addEventListener('click', function () {
    if (document.getElementById('password').value === document.getElementById('passwordConfirm').value) {
      panel.sendNewPassword(document.getElementById('password').value)
    } else {
      swal({
        title: 'Password mismatch!',
        text: 'Your passwords do not match, please try again.',
        icon: 'error'
      }).then(() => {
        panel.changePassword()
      })
    }
  })
}

panel.sendNewPassword = function (pass) {
  axios.post('api/password/change', {password: pass})
    .then(function (response) {
      if (response.data.success === false) {
        if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
        else return swal('An error occurred', response.data.description, 'error')
      }

      swal({
        title: 'Woohoo!',
        text: 'Your password was changed successfully.',
        icon: 'success'
      }).then(() => {
        location.reload()
      })
    })
    .catch(function (error) {
      console.log(error)
      return swal('An error occurred', 'There was an error with the request, please check the console for more information.', 'error')
    })
}

panel.setActiveMenu = function (item) {
  var menu = document.getElementById('menu')
  var items = menu.getElementsByTagName('a')
  for (var i = 0; i < items.length; i++) { items[i].className = '' }

  item.className = 'is-active'
}

window.onload = function () {
  panel.preparePage()
}
