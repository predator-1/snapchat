module.exports = Account

var debug = require('debug')('snapchat:account')

var constants = require('../lib/constants')
var StringUtils = require('../lib/string-utils')

var SKBlob = require('../models/blob')

/**
 * Snapchat wrapper for account-related API calls.
 *
 * @param {Object} opts
 */
function Account (client, opts) {
  var self = this
  if (!(self instanceof Account)) return new Account(client, opts)
  if (!opts) opts = {}

  self.client = client
}

/**
 * Updates the number of best friends to display.
 *
 * @param {number} number A number from 3 to 7. Defaults to 3 and will max out at 7.
 * @param {function} cb
 */
Account.prototype.updateBestFriendsCount = function (number, cb) {
  var self = this
  debug('Account.updateBestFriendsCount (%d)', number)

  if (number < 3) number = 3
  if (number > 7) number = 7

  self.client.post(constants.endpoints.account.setBestsCount, {
    'num_best_friends': number | 0,
    'username': self.client.username
  }, function (err, response, body) {
    if (err) {
      return cb(err)
    } else {
      var result = StringUtils.tryParseJSON(body)

      if (result) {
        self.client.currentSession.bestFriendUsernames = result['best_friends']
        return cb(null)
      }
    }

    cb('Snapchat.Account.updateBestFriendsCount parse error')
  })
}

/**
 * Updates who can send you snaps.
 *
 * @param privacy \c SnapPrivacy.Friends or \c SnapPrivacy.Everyone. Defaults to \c SnapPrivacy.Friends.
 * @param {function} cb
 */
Account.prototype.updateSnapPrivacy = function (privacy, cb) {
  var self = this
  debug('Account.updateSnapPrivacy (%d)', privacy)

  privacy = Math.min(privacy, 1) | 0

  self.client.post(constants.endpoints.account.settings, {
    'action': 'updatePrivacy',
    'privacySetting': privacy,
    'username': self.client.username
  }, cb)
}

/**
 * Updates who can see your stories. \e friends is only necessary when using \c StoryPrivacy.Custom.
 *
 * @param {number} privacy \c StoryPrivacy.Everyone, \c StoryPrivacy.Friends, \c StoryPrivacy.Custom.
 * @param {Array[string]} friends Optional list of strings of usernames to hide your stories from. Used only when \c privacy is \c StoryPrivacy.Custom.
 * @param {function} cb
 */
Account.prototype.updateStoryPrivacy = function (privacy, friends, cb) {
  var self = this
  debug('Account.updateStoryPrivacy (%d)', privacy)

  if (typeof friends === 'function') {
    cb = friends
    friends = null
  }

  var params = {
    'action': 'updateStoryPrivacy',
    'privacySetting': constants.stringFromStoryPrivacy(privacy | 0),
    'username': self.client.username
  }

  if (friends) {
    params.storyFriendsToBlock = JSON.stringify(friends)
  }

  self.client.post(constants.endpoints.account.settings, params, cb)
}

/**
 * Updates your account's email address.
 *
 * @param {string} address Your new email address.
 * @param {function} cb
 */
Account.prototype.updateEmail = function (address, cb) {
  var self = this
  debug('Account.updateEmail (%s)', address)

  self.client.post(constants.endpoints.account.settings, {
    'action': 'updateEmail',
    'email': address,
    'username': self.client.username
  }, cb)
}

/**
 * Updates whether your account can be found with your phone number.
 *
 * @param {boolean} searchable The new value for this preference.
 * @param {function} cb
 */
Account.prototype.updateSearchableByNumber = function (searchable, cb) {
  var self = this
  debug('Account.updateSearchableByNumber (%d)', searchable)

  self.client.post(constants.endpoints.account.settings, {
    'action': 'updateSearchableByPhoneNumber',
    'searchable': !!searchable,
    'username': self.client.username
  }, cb)
}

/**
 * Updates your "notification sounds" preference.
 *
 * @param {boolean} enableSound The new value for this preference.
 * @param {function} cb
 */
Account.prototype.updateNotificationSoundSetting = function (enableSound, cb) {
  var self = this
  debug('Account.updateNotificationSoundSetting (%d)', enableSound)

  self.client.post(constants.endpoints.account.settings, {
    'action': 'updateNotificationSoundSetting',
    'notificationSoundSetting': enableSound ? 'ON' : 'OFF',
    'username': self.client.username
  }, cb)
}

/**
 * Updates your display name.
 *
 * @discussion Your "display name" is what your contact name defaults to when someone new adds you, not your username.
 * @param {string} displayName Your new display name.
 * @param {function} cb
 */
Account.prototype.updateDisplayName = function (displayName, cb) {
  var self = this
  debug('Account.updateDisplayName (%s)', displayName)

  self.client.friends.updateDisplayNameForUser(self.client.username, displayName, cb)
}

/**
 * Updates your account's feature settings.
 *
 * @discussion See \c constants.Feature for valid keys. Invalid keys will be silently ignored.
 * @warning Raises an exception if \e settings contains more than 8 key-value pairs.
 *
 * @param Object settings A dictionary of string-boolean pairs. Missing keys-value pairs default to the current values. Behavior is undefined for values other than booleans.
 * @param {function} cb
 */
Account.prototype.updateFeatureSettings = function (settings, cb) {
  var self = this
  debug('Account.updateFeatureSettings')

  var features = { }
  features[constants.featureSettings.frontFacingFlash] = settings[constants.featureSettings.frontFacingFlash] || self.client.currentSession.enableFrontFacingFlash
  features[constants.featureSettings.replaySnaps] = settings[constants.featureSettings.replaySnaps] || self.client.currentSession.enableReplaySnaps
  features[constants.featureSettings.smartFilters] = settings[constants.featureSettings.smartFilters] || self.client.currentSession.enableSmartFilters
  features[constants.featureSettings.visualFilters] = settings[constants.featureSettings.visualFilters] || self.client.currentSession.enableVisualFilters
  features[constants.featureSettings.powerSaveMode] = settings[constants.featureSettings.powerSaveMode] || self.client.currentSession.enablePowerSaveMode
  features[constants.featureSettings.specialText] = settings[constants.featureSettings.specialText] || self.client.currentSession.enableSpecialText
  features[constants.featureSettings.swipeCashMode] = settings[constants.featureSettings.swipeCashMode] || self.client.currentSession.enableSwipeCashMode
  features[constants.featureSettings.travelMode] = settings[constants.featureSettings.travelMode] || self.client.currentSession.enableTravelMode

  self.client.post(constants.endpoints.update.featureSettings, {
    'settings': JSON.stringify(features),
    'username': self.client.username
  }, cb)
}

/**
 * Downloads your account's snaptag, a personal Snapchat QR code.
 *
 * @param {function} cb
 */
Account.prototype.downloadSnaptag = function (cb) {
  var self = this
  debug('Account.downloadSnaptag')

  self.client.post(constants.endpoints.account.snaptag, {
    'image': self.client.currentSession.QRPath,
    'type': 'SVG',
    'username': self.client.username
  }, function (err, response, body) {
    if (err) {
      cb(err)
    } else {
      cb(null, new SKBlob(new Buffer(body)))
    }
  })
}

/**
 * Uploads a new animated avatar. Not working yet.
 *
 * @param {Array[Buffer]} images An array of 5 image \c Buffer objects.
 * @param {function} cb
 */
Account.prototype.uploadAvatar = function (images, cb) {
  var self = this
  debug('Account.uploadAvatar')

  throw new Error("Account.uploadAvatar TODO")
  // SKEPAccount.avatar.set
  // multipart/form-data; takes a single "data" parameter in addition to the usual "username" param
}

/**
 * Downloads the animated avatar for \c user. Currently encrypted, or something.
 *
 * @param {string} username The username tied to the avatar to download.
 * @param {function} cb
 */
Account.prototype.downloadAvatar = function (username, cb) {
  var self = this
  debug('Account.downloadAvatar')

  self.client.post(constants.endpoints.account.avatar.get, {
    'username_image': username,
    'username': self.client.username,
    'size': 'MEDIUM'
  }, function (err, response, body) {
    if (err) {
      cb(err)
    } else {
      SKBlob.decompress(new Buffer(body), cb)
    }
  })
}

/**
 * Updates your TOS agreement status for each of the three Terms of Service's.
 *
 * @param {function} cb
 */
Account.prototype.updateTOSAgreementStatus = function (snapcash, snapcashV2, square, cb) {
  var self = this
  debug('Account.updateTOSAgreementStatus')

  var agreements = {
    'snapcash_new_tos_accepted': snapcash ? 'true' : 'false',
    'snapcash_tos_v2_accepted': snapcashV2 ? 'true' : 'false',
    'square_tos_accepted': square ? 'true' : 'false'
  }

  self.client.post(constants.endpoints.update.user, {
    'username': self.client.username,
    'agreements': agreements
  }, cb)
}
