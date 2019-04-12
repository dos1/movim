var Chat = {
    left : null,
    right: null,
    date: null,
    separator: null,
    currentDate: null,
    lastScroll: null,
    lastHeight: null,
    edit: false,

    // Chat state
    composing: false,
    since: null,
    sended: false,

    // Autocomplete vars.
    autocompleteList: null,
    lastAutocomplete: null,
    searchAutocomplete: null,

    autocomplete: function(event, jid)
    {
        Rooms_ajaxMucUsersAutocomplete(jid);
    },
    onAutocomplete: function(usersList)
    {
        Chat.autocompleteList = usersList;
        usersList = Object.values(usersList);

        var textarea = Chat.getTextarea();

        var words = textarea.value.toLowerCase().trim().split(' ');
        var last = words[words.length - 1].trim();

        if (last == '') {
            // Space or nothing, so we put the first one in the list
            textarea.value += usersList[0] + ' ';
            Chat.lastAutocomplete = usersList[0];
            Chat.searchAutocomplete = null;
        } else if (typeof Chat.lastAutocomplete === 'string'
        && Chat.lastAutocomplete.toLowerCase() == last
        && Chat.searchAutocomplete == null) {
            var index = (usersList.indexOf(Chat.lastAutocomplete) == usersList.length - 1)
                ? -1
                : usersList.indexOf(Chat.lastAutocomplete);

            if (textarea.value.slice(-1) == ' ') textarea.value = textarea.value.trim() + ' ';

            // Full complete, so we iterate
            Chat.lastAutocomplete = usersList[index + 1];
            textarea.value = textarea.value.slice(0, -last.length - 1) + Chat.lastAutocomplete + ' ';
            Chat.searchAutocomplete = null;
        } else {
            // Searching for nicknames starting with
            if (Chat.lastAutocomplete ==  null
            || last != Chat.lastAutocomplete.toLowerCase()) {
                Chat.searchAutocomplete = last;
                Chat.lastAutocomplete = null;
            }

            var start = (typeof Chat.lastAutocomplete === 'string')
                ? usersList.indexOf(Chat.lastAutocomplete) + 1
                : start = 0;

            for (var i = start; i < usersList.length; i++) {
                if (Chat.searchAutocomplete == usersList[i].substring(0, Chat.searchAutocomplete.length).toLowerCase()) {
                    textarea.value = textarea.value.trim().slice(0, -last.length) + usersList[i] + ' ';
                    Chat.lastAutocomplete = usersList[i];
                    break;
                }
            }
        }
    },
    quoteMUC: function(nickname, add)
    {
        var textarea = Chat.getTextarea();
        if (add) {
            if (textarea.value.search(nickname) === -1) {
                textarea.value = nickname + ' ' + textarea.value;
            }
        } else {
            textarea.value = nickname + ' ';
        }

        textarea.focus();
    },
    insertAtCursor: function(textToInsert)
    {
        textarea = Chat.getTextarea();

        const value = textarea.value;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        textarea.value = value.slice(0, start) + textToInsert + value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;

        textarea.focus();
        Chat.toggleAction();
    },
    sendMessage: function()
    {
        var textarea = Chat.getTextarea();

        var text = textarea.value;
        var muc = Boolean(textarea.dataset.muc);
        var jid = textarea.dataset.jid;

        textarea.focus();

        if (!Chat.sended) {
            Chat.sended = true;

            document.querySelector('.chat_box span.send').classList.add('sending');

            let xhr;

            if (Chat.edit) {
                Chat.edit = false;
                xhr = Chat_ajaxHttpCorrect(jid, text);
            } else {
                xhr = Chat_ajaxHttpSendMessage(jid, text, muc);
            }

            xhr.onreadystatechange = function() {
                if (this.readyState == 4) {
                    if (this.status >= 200 && this.status < 400) {
                        Chat.sendedMessage();
                    }

                    if (this.status >= 400 || this.status == 0) {
                        Chat.failedMessage();
                    }
                }
            };
        }
    },
    sendedMessage: function()
    {
        Chat.sended = false;

        document.querySelector('.chat_box span.send').classList.remove('sending');

        var textarea = Chat.getTextarea();
        var discussion = Chat.getDiscussion();
        discussion.scrollTop = discussion.scrollHeight;
        localStorage.removeItem(textarea.dataset.jid + '_message');
        Chat.clearReplace();
        Chat.toggleAction();
    },
    failedMessage: function()
    {
        Notification.toast(Chat.delivery_error);
        Chat.sended = false;
        document.querySelector('.chat_box span.send').classList.remove('sending');
    },
    clearReplace: function()
    {
        Chat.edit = false;
        var textarea = Chat.getTextarea();
        textarea.value = localStorage.getItem(textarea.dataset.jid + '_message');
        MovimUtils.textareaAutoheight(textarea);
    },
    editPrevious: function()
    {
        var textarea = Chat.getTextarea();
        if (textarea.value == ''
        && Boolean(textarea.dataset.muc) == false) {
            Chat_ajaxLast(textarea.dataset.jid);
        }
    },
    focus: function()
    {
        Chat.sended = false;
        Chat.composing = false;
        Chat.clearReplace();
        Chat.toggleAction();

        var textarea = Chat.getTextarea();
        textarea.onkeydown = function(event) {
            if (this.dataset.muc
            && event.keyCode == 9) {
                event.preventDefault();
                if (Chat.autocompleteList == null) {
                    Chat.autocomplete(event, this.dataset.jid);
                } else {
                    Chat.onAutocomplete(Chat.autocompleteList);
                }
                return;
            }

            if (event.keyCode == 38) {
                Chat.editPrevious();
            } else if (event.keyCode == 40
            && (this.value == '' || Chat.edit == true)) {
                localStorage.removeItem(textarea.dataset.jid + '_message');
                Chat.clearReplace();
            }
        };

        textarea.onkeypress = function(event) {
            if (event.keyCode == 13) {
                if ((window.matchMedia('(max-width: 1024px)').matches && !event.shiftKey)
                || (window.matchMedia('(min-width: 1025px)').matches && event.shiftKey)) {
                    return;
                }

                Chat.composing = false;
                Chat.sendMessage();

                return false;
            } else if (Chat.composing === false) {
                Chat.composing = true;
                Chat_ajaxSendComposing(this.dataset.jid, Boolean(this.dataset.muc));
                Chat.since = new Date().getTime();
            }
        };

        textarea.onkeyup = function(event) {
            localStorage.setItem(this.dataset.jid + '_message', this.value);

            // A little timeout to not spam the server with composing states
            setTimeout(function()
            {
                if (Chat.since + 3000 < new Date().getTime()) {
                    Chat.composing = false;
                }
            }, 3000);

            Chat.toggleAction();
        };

        textarea.oninput = function() {
            var discussion = Chat.getDiscussion();
            var scrolled = (discussion.scrollHeight - discussion.scrollTop === discussion.clientHeight);
            MovimUtils.textareaAutoheight(this);

            if (scrolled) discussion.scrollTop = discussion.scrollHeight;
        }

        textarea.onchange = function() {
            Chat.toggleAction();
        };

        if (document.documentElement.clientWidth > 1024) {
            textarea.focus();
        }

        Chat.autocompleteList = null;
    },
    setTextarea: function(value)
    {
        Chat.edit = true;
        var textarea = Chat.getTextarea();
        textarea.value = value;
        MovimUtils.textareaAutoheight(textarea);
        textarea.focus();
    },
    setGeneralElements(date, separator) {
        var div = document.createElement('div');

        Chat.currentDate = null;

        div.innerHTML = date;
        Chat.date = div.firstChild.cloneNode(true);
        div.innerHTML = separator;
        Chat.separator = div.firstChild.cloneNode(true);
    },
    setSpecificElements : function(left, right) {
        var div = document.createElement('div');

        Chat.currentDate = null;

        div.innerHTML = left;
        Chat.left = div.firstChild.cloneNode(true);
        div.innerHTML = right;
        Chat.right = div.firstChild.cloneNode(true);
    },
    setScrollBehaviour : function() {
        var discussion = Chat.getDiscussion();
        discussion.onscroll = function() {
            if (this.scrollTop < 1
            && discussion.querySelectorAll('ul li div.bubble p').length >= Chat.pagination) {
                Chat_ajaxGetHistory(
                    Chat.getTextarea().dataset.jid,
                    Chat.currentDate,
                    Chat.getTextarea().dataset.muc,
                    true);
            }

            Chat.lastHeight = this.clientHeight;
        };
    },
    setReactionButtonBehaviour : function() {
        let reactions = document.querySelectorAll('#chat_widget span.reaction');
        let i = 0;

        while (i < reactions.length) {
            reactions[i].onclick = function() {
                Stickers_ajaxReaction(this.dataset.mid);
            }

            i++;
        }
    },
    checkDiscussion : function(page) {
        for (var firstKey in page) break;
        if (page[firstKey] == null) return false;

        for (var firstMessageKey in page[firstKey]) break;
        var firstMessage = page[firstKey][firstMessageKey];
        if (firstMessage == null) return false;

        var contactJid = firstMessage.user_id == firstMessage.jidfrom
            ? firstMessage.jidto
            : firstMessage.jidfrom;

        if (document.getElementById(MovimUtils.cleanupId(contactJid + '-discussion'))
        == null) return false;

        return true;
    },
    appendMessagesWrapper : function(page, prepend, scroll) {
        var discussion = Chat.getDiscussion();

        if (page && Chat.checkDiscussion(page)) {
            var scrolled = MovimTpl.isPanelScrolled();

            if (discussion == null) return;

            Chat.lastScroll = discussion.scrollHeight;

            for(date in page) {
                if (prepend === undefined || prepend === false) {
                    Chat.appendDate(date, prepend);
                }

                for(speakertime in page[date]) {
                    if (!Chat.currentDate) {
                        Chat.currentDate = page[date][speakertime].published;
                    }

                    Chat.appendMessage(speakertime, page[date][speakertime], prepend);
                }

                if (prepend && date) {
                    Chat.appendDate(date, prepend);
                }
            }

            // Only scroll down if scroll was at the bottom before the new msg
            // => don't scroll if the user was reading previous messages
            if (scrolled && prepend !== true) {
                setTimeout(function() {
                    MovimTpl.scrollPanel();
                }, 20);
            }

            if (prepend) {
                // And we scroll where we were
                var scrollDiff = discussion.scrollHeight - Chat.lastScroll;
                discussion.scrollTop += scrollDiff;
                Chat.lastScroll = discussion.scrollHeight;
            }

            var chat = document.querySelector('#chat_widget');
            var lastMessage = chat.querySelector('ul li:not(.oppose):last-child div.bubble > div:last-child');
            var textarea = Chat.getTextarea();

            if (textarea && lastMessage) {
                Chat_ajaxDisplayed(
                    textarea.dataset.jid,
                    lastMessage.id
                );
            }
        } else if (discussion !== null) {
            if (discussion.querySelector('ul').innerHTML === '') {
                discussion.querySelector('ul').classList.remove('spin');
                discussion.querySelector('.placeholder').classList.add('show');
            }
        }

        Chat.setScrollBehaviour();
        Chat.setReactionButtonBehaviour();

        if (scroll) {
            MovimTpl.scrollPanel();
        }
    },
    appendMessage : function(idjidtime, data, prepend) {
        if (data.body === null) return;

        var bubble = null,
            mergeMsg = false,
            msgStack,
            refBubble;

        var isMuc = (document.querySelector('#chat_widget div.contained').dataset.muc == 1);
        var jidtime = idjidtime.substring(idjidtime.indexOf('<') + 1);

        if (prepend) {
            refBubble = document.querySelector('#chat_widget .contained section > ul > li:first-child');
            msgStack = document.querySelector("[data-bubble='" + jidtime + "']");
        } else {
            refBubble = document.querySelector("#chat_widget .contained section > ul > li:last-child");
            var stack = document.querySelectorAll("[data-bubble='" + jidtime + "']");
            msgStack = stack[stack.length-1];
        }

        if (msgStack != null
            && msgStack.parentNode == refBubble
            && (data.file === undefined || data.file === null)
            && (data.sticker === undefined || data.sticker === null)
            && !refBubble.querySelector('div.bubble').classList.contains('sticker')
            && !refBubble.querySelector('div.bubble').classList.contains('file')
            && ['jingle_start'].indexOf(data.type) < 0
        ) {
            bubble = msgStack.parentNode;
            mergeMsg = true;
        } else {
            if (data.user_id == data.jidfrom
            || data.mine) {
                bubble = Chat.right.cloneNode(true);
                if (data.mine) {
                    id = data.jidfrom + '_conversation';
                } else {
                    id = data.jidto + '_conversation';
                }
            } else {
                bubble = Chat.left.cloneNode(true);
                id = data.jidfrom + '_conversation';
            }

            id = MovimUtils.cleanupId(id);

            bubble.querySelector('div.bubble').dataset.bubble = jidtime;
            bubble.querySelector('div.bubble').dataset.publishedprepared = data.publishedPrepared;
        }

        if (['jingle_start'].indexOf(data.type) >= 0) {
            bubble.querySelector('div.bubble').classList.add('call');
        }

        var msg = bubble.querySelector('div.bubble > div');
        var span = msg.querySelector('span:not(.reaction)');
        var p = msg.getElementsByTagName('p')[0];
        var reaction = msg.querySelector('span.reaction');
        var reactions = msg.querySelector('ul.reactions');

        // If there is already a msg in this bubble, create another div (next msg or replacement)
        if (bubble.querySelector('div.bubble p')
        && bubble.querySelector('div.bubble p').innerHTML != '') {
            msg = document.createElement('div');
            span = document.createElement('span');
            span.className = 'info';
            p = document.createElement('p');
            reaction = reaction.cloneNode(true);
            reactions = document.createElement('ul');
            reactions.className = 'reactions';
        }

        if (data.rtl) {
            bubble.querySelector('div.bubble').setAttribute('dir', 'rtl');
        }

        if (data.body.match(/^\/me\s/)) {
            p.classList.add('quote');
            data.body = data.body.substr(4);
        }

        if (data.body.match(/^\/code/)) {
            p.classList.add('code');
            data.body = data.body.substr(6).trim();
        }

        if (data.id != null) {
            msg.setAttribute('id', data.id);
        }

        if (data.sticker != null) {
            bubble.querySelector('div.bubble').classList.add('sticker');
            p.appendChild(Chat.getStickerHtml(data.sticker));
        } else {
            p.innerHTML = data.body;
        }

        if (data.file != null) {
            bubble.querySelector('div.bubble').classList.add('file');
            p.appendChild(Chat.getFileHtml(data.file, data.sticker));
        }

        if (data.oldid) {
            span.appendChild(Chat.getEditedIcoHtml());
        }

        if (data.user_id == data.jidfrom) {
            if (data.displayed) {
                span.appendChild(Chat.getDisplayedIcoHtml(data.displayed));
            } else if (data.delivered) {
                span.appendChild(Chat.getDeliveredIcoHtml(data.delivered));
            }
        }

        if (data.reactionsHtml !== undefined) {
            reactions.innerHTML = data.reactionsHtml;
        }

        msg.appendChild(p);
        msg.appendChild(span);
        msg.appendChild(reactions);

        reaction.dataset.mid = data.mid;
        msg.appendChild(reaction);

        var elem = document.getElementById(data.oldid);
        if (!elem) {
            elem = document.getElementById(data.id);
        }

        if (elem) {
            elem.parentElement.replaceChild(msg, elem);
            mergeMsg = true;
        } else {
            if (prepend) {
                bubble.querySelector('div.bubble').insertBefore(msg, bubble.querySelector('div.bubble').firstChild);
            } else {
                bubble.querySelector('div.bubble').appendChild(msg);
            }
        }

        /* MUC specific */
        if (isMuc) {
            bubble.querySelector('div.bubble').dataset.publishedprepared =
                data.resource + ' – ' + data.publishedPrepared;

            if (data.moderator) {
                bubble.querySelector('div.bubble').classList.add('moderator');
            }

            if (data.mine) {
                icon = bubble.querySelector('span.control.icon');
            } else {
                icon = bubble.querySelector('span.primary.icon');
            }

            if (icon.querySelector('img') == undefined) {
                if (data.icon_url) {
                    var img = document.createElement('img');
                    img.setAttribute('src', data.icon_url);

                    icon.appendChild(img);
                } else {
                    icon.classList.add('color');
                    icon.classList.add(data.color);
                    icon.innerHTML = data.icon;
                }

                icon.dataset.resource = data.resource;
            }

            if (data.quoted) {
                bubble.querySelector('div.bubble').classList.add('quoted');
            }
        }

        if (prepend) {
            Chat.currentDate = data.published;

            // We prepend
            if (!mergeMsg) {
                MovimTpl.prepend('#' + id, bubble.outerHTML);
            }
        } else {
            if (!mergeMsg) {
                MovimTpl.append('#' + id, bubble.outerHTML);
            }
        }
    },
    appendDate: function(date, prepend) {
        var list = document.querySelector('#chat_widget > div ul');

        if (document.getElementById(MovimUtils.cleanupId(date)) && !prepend) return;

        dateNode = Chat.date.cloneNode(true);
        dateNode.dataset.value = date;
        dateNode.querySelector('p').innerHTML = date;
        dateNode.id = MovimUtils.cleanupId(date);

        var dates = list.querySelectorAll('li.date');

        if (prepend) {
            // If the date was already displayed we remove it
            if (dates.length > 0
            && dates[0].dataset.value == date) {
                dates[0].parentNode.removeChild(dates[0]);
            }

            list.insertBefore(dateNode, list.firstChild);
        } else {
            if (dates.length > 0
            && dates[dates.length-1].dataset.value == date) {
                return;
            }

            list.appendChild(dateNode);
        }
    },
    insertSeparator: function(counter) {
        separatorNode = Chat.separator.cloneNode(true);

        var list = document.querySelector('#chat_widget > div ul');

        if (list.querySelector('li.separator')) return;

        var messages = document.querySelectorAll('#chat_widget > div ul div.bubble p');

        if (messages.length > counter && counter > 0) {
            var p = messages[messages.length - counter];
            list.insertBefore(separatorNode, p.parentNode.parentNode.parentNode);
        }
    },
    getStickerHtml: function(sticker) {
        var img = document.createElement('img');
        if (sticker.url) {
            if (sticker.thumb) {
                img.setAttribute('src', sticker.thumb);
            } else {
                img.setAttribute('src', sticker.url);
            }

            if (sticker.width)  img.setAttribute('width', sticker.width);
            if (sticker.height) {
                img.setAttribute('height', sticker.height);
            } else {
                img.setAttribute('height', '170');
            }
        }

        if (sticker.picture) {
            img.classList.add('active');
            img.setAttribute('onclick', 'Preview_ajaxShow("' + sticker.url + '")');
        }

        return img;
    },
    getFileHtml: function(file, sticker) {
        var div = document.createElement('div');
        div.setAttribute('class', 'file');

        var a = document.createElement('a');
        if (sticker == null) {
            a.textContent = file.name;
        }
        a.setAttribute('href', file.uri);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');

        div.appendChild(a);

        var span = document.createElement('span');
        if (file.size) {
            span.innerHTML = file.cleansize;
        }
        span.setAttribute('class', 'size');

        a.appendChild(span);

        return div;
    },
    getEditedIcoHtml: function() {
        var i = document.createElement('i');
        i.className = 'material-icons';
        i.innerText = 'edit';
        return i;
    },
    getDeliveredIcoHtml: function(delivered) {
        var i = document.createElement('i');
        i.className = 'material-icons';
        i.innerText = 'check';
        i.setAttribute('title', delivered);
        return i;
    },
    getDisplayedIcoHtml: function(displayed) {
        var i = document.createElement('i');
        i.className = 'material-icons';
        i.innerText = 'done_all';
        i.setAttribute('title', displayed);
        return i;
    },
    toggleAction: function() {
        var send_button = document.querySelector('.chat_box span.send');
        var attachment_button = document.querySelector('.chat_box span.upload');
        if (send_button && attachment_button) {
            if (Chat.getTextarea().value.length > 0) {
                send_button.classList.remove('hide');
                attachment_button.classList.add('hide');
            } else {
                send_button.classList.add('hide');
                attachment_button.classList.remove('hide');
            }
        }
    },
    getTextarea: function() {
        var textarea = document.querySelector('#chat_textarea');
        if (textarea) return textarea;
    },
    getDiscussion: function() {
        return document.querySelector('#chat_widget div.contained');
    }
};

MovimWebsocket.attach(function() {
    Chat_ajaxInit();

    var jid = MovimUtils.urlParts().params[0];
    var room = (MovimUtils.urlParts().params[1] === 'room');
    if (jid) {
        if (Boolean(document.getElementById(MovimUtils.cleanupId(jid) + '-conversation'))) {
            Chat_ajaxGetHistory(jid, Chat.currentDate, room, false);
        } else {
            MovimTpl.showPanel();

            if (room) {
                Chat_ajaxGetRoom(jid);
            } else {
                Chat_ajaxGet(jid);
            }
        }
    }
});

if (typeof Upload != 'undefined') {
    Upload.attach(function(file) {
        Chat_ajaxHttpSendMessage(Chat.getTextarea().dataset.jid, false, Boolean(Chat.getTextarea().dataset.muc), false, false, file);
    });
}

document.addEventListener('focus', function() {
    var textarea = Chat.getTextarea();
    if (textarea) textarea.focus();
});

window.addEventListener('resize', function() {
    var discussion = Chat.getDiscussion();
    if (discussion) {
        discussion.scrollTop += Chat.lastHeight - discussion.clientHeight;
        Chat.lastHeight = discussion.clientHeight;
    }
});

var state = 0;
