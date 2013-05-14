$("#noty_number").html("");
$("#noty_number").removeClass("has_noty");

var XMPP_client = {
    connection: null,

    jid_to_id: function (jid) {

        return Strophe.getBareJidFromJid(jid)
               .replace("@", "-")
               .replace(".", "-");
    },

    on_roster: function (iq) {
        $(iq).find('item').each(function () {
            var jid = $(this).attr('jid');
            var name = $(this).attr('name') || jid;

            XMPP_client.insert_contact(getNewContactHtml(jid, name));
        });

        // set up presence handler and send initial presence
        XMPP_client.connection.addHandler(XMPP_client.on_presence, null, "presence");
        /*
         * When chat load set presence value
         */
        if(localStorage.status != undefined)
        {
            var status = $pres({from: XMPP_client.connection.jid}).c("show").t(localStorage.status);
            XMPP_client.connection.send(status);
        }
        else
          XMPP_client.connection.send($pres());
    },
    pending_subscriber: new Array(),

    on_presence: function (presence) {
        var ptype = $(presence).attr('type');
        var from = $(presence).attr('from');
        var jid_id = XMPP_client.jid_to_id(from);

        if (ptype === 'subscribe') {
            // populate pending_subscriber, the approve-jid span, and
            // open the dialog
            XMPP_client.pending_subscriber.push(from);

            /* If user recive new subscription -> show notyfication */
            $("#noty_number").addClass("has_noty");

            $("#no-new-requests").remove();

            var val = $(".has_noty").html();
            if(val == "")
              val = 0;

            var number_noty = parseInt(val) + 1;
            $(".has_noty").html(number_noty);
            /* ------------- */

            $("#user-requests #user-requests-list").append("<li class='"+ from +"'><div class=request-name>"+ from + "</div><button class='btn btn-mini btn-primary' data-dismiss='modal' id='btnApprove' aria-hidden='true'>Approve</button> "
	  + "<button id='btnDeny' class='btn btn-mini'>Deny</button></li>");
            $('#approve-jid').text(Strophe.getBareJidFromJid(from));
        } else if (ptype !== 'error') {
            var contact = $('.roster-area li#' + jid_id + ' .roster-contact')
                          .removeClass("online")
                          .removeClass("away")
                          .removeClass("xa")
                          .removeClass("dnd")
                          .removeClass("offline");
            if (ptype === 'unavailable') {
                contact.addClass("offline");
            } else {
                var show = $(presence).find("show").text();
                if (show === "" || show == "chat") {
                    contact.addClass("online");
                }
                if (show == "away") {
                    contact.addClass("away");
                }
                if (show == "dnd") {
                    contact.addClass("dnd");
                }
                if (show == "xa") {
                    contact.addClass("xa");
                }
            }

            var li = contact.parent();
            li.remove();
            XMPP_client.insert_contact(li);
        }

        // reset addressing for user since their presence changed
        jid_id = XMPP_client.jid_to_id(from);
        $('#chat-' + jid_id).data('jid', Strophe.getBareJidFromJid(from));

        return true;
    },

    on_roster_changed: function (iq) {
        $(iq).find('item').each(function () {
            var sub = $(this).attr('subscription');
            var jid = $(this).attr('jid');
            var name = $(this).attr('name') || jid;
            var jid_id = XMPP_client.jid_to_id(jid);

            if (sub === 'remove') {
                // contact is being removed
                $('#' + jid_id).remove();
            } else {
                if ($('#' + jid_id).length > 0) {
                    $('#' + jid_id).replaceWith(getNewContactHtml(jid, name));
                } else {
                    $("#chatAlertArea").html(getSuccessAlertHTML("You successfully added contact " + name));
                    $("#chatAlertArea div").show("slow");
                    XMPP_client.insert_contact(getNewContactHtml(jid, name));
                }
            }
        });

        return true;
    },

    on_message: function (message) {
        var full_jid = $(message).attr('from');
        var jid = Strophe.getBareJidFromJid(full_jid);
        var jid_id = XMPP_client.jid_to_id(jid);

        if ($('#chat-' + jid_id).length === 0) {
            makeNewTab(jid_id, jid);
        }

        $('#chat-' + jid_id).data('jid', full_jid);

        //$('#chat-area').tabs('select', '#chat-' + jid_id);
        //$('#chat-' + jid_id + ' input').focus();

        var composing = $(message).find('composing');
        if (composing.length > 0) {
            $('#chat-' + jid_id + ' .chat-messages').append(
                "<div class='chat-event'>" +
                  Strophe.getNodeFromJid(jid) +
                  " is typing...</div>");

            XMPP_client.scroll_chat(jid_id);
        }

        var body = $(message).find("html > body");

        if (body.length === 0) {
            body = $(message).find('body');
            if (body.length > 0) {
                body = body.text()
            } else {
                body = null;
            }
        } else {
            body = body.contents();

            var span = $("<span></span>");
            body.each(function () {
                if (document.importNode) {
                    $(document.importNode(this, true)).appendTo(span);
                } else {
                    // IE workaround
                    span.append(this.xml);
                }
            });

            body = span;
        }

        if (body) {

            var chatPage = $("#chatPage").val();
            if(chatPage != "true")
            {
                /* If user recive message -> show notyfication */
                $("#noty_number").addClass("has_noty");

                var val = $(".has_noty").html();
                if(val == "")
                  val = 0;

                var number_noty = parseInt(val) + 1;
                $(".has_noty").html(number_noty);
                /* ------------- */
            }

            /*
             * When we recieve new message play sound...
             */
            var audioElement = document.createElement('audio');
            audioElement.setAttribute('src', 'http://127.0.0.1:8000/site_media/static/nm.mp3');
            audioElement.setAttribute('src', 'http://127.0.0.1:8000/site_media/static/nm.ogg');
            audioElement.play();
            /*
             * If tab is no active, add color to notyfiy new message
             */
            var conversations = $("#chat-area").find(".conversation-header");
            var elem = conversations.find("td:contains('"+ jid  +"')");
            var tabToUpdate = elem.closest("li");
            if(!tabToUpdate.hasClass("ui-state-active")) {
                //tabToUpdate.addClass("new-message-alert");
                tabToUpdate.css("background", "#FFD685");
            }

            /*
             * eg. of id variable: ivan (this is actualy name of user without domain name
             */
            var id = Strophe.getNodeFromJid(jid);

            /*
             * If user isn't on chat page, then add new messages to list of unreaded messages
             */
            if(chatPage == null)
            {
                /*
                 * If message already exist in list with unreaded messages
                 */
                if($("#msg" + id).length > 0){
                    $("#msg" + id).html(""
                  + "<div class='new-message'><b>From " + id + ": </b>"
                  + body
                  + "</div><button class='close'>&times;</button></li>");
                }

                /*
                 * If message don't exist in list with unreaded messages
                 */
                else{
                    $("#new-messages-list").append(""
                  + "<li "
                  + "id=msg" + id
                  + " class="
                  + jid
                  + ">"
                  + "<div class='new-message'><b>From " + id + ": </b>"
                  + body
                  + "</div><button class='close'>&times;</button></li>");
                }
            }

            localStorage.unreadMessages = $("#new-messages-list").html();

            // remove notifications since user is now active
            $('#chat-' + jid_id + ' .chat-event').remove();

            // add the new message
            $('#chat-' + jid_id + ' .chat-messages').append(
                "<div class='chat-message'>" +
                  "&lt;<span class='chat-name'>" +
                  Strophe.getNodeFromJid(jid) +
                  "</span>&gt;<span class='chat-text'>" +
                  "</span></div>");

            $('#chat-' + jid_id + ' .chat-message:last .chat-text')
            .append(body);

            XMPP_client.scroll_chat(jid_id);
        }

        return connection;
    },

    scroll_chat: function (jid_id) {
        var chatPage = $("#chatPage").val();
        if(chatPage == "true")
        {
            var div = $('#chat-' + jid_id + ' .chat-messages').get(0);
            div.scrollTop = div.scrollHeight;
        }
    },

    /*
     * Used for sorting list of contact by presence value (eg. online, away, etc.)
     */
    presence_value: function (elem) {
        if (elem.hasClass('online')) {
            return 4;
        } else if (elem.hasClass('away')) {
            return 3;
        }
        else if (elem.hasClass('dnd')) {
            return 2;
        }
        else if (elem.hasClass('xa')) {
            return 1;
        }

        return 0;
    },

    /*
     * Insert contacts to contact list (in pageslide)
     */
    insert_contact: function (elem) {
        var jid = elem.find('.roster-jid').text();
        var pres = XMPP_client.presence_value(elem.find('.roster-contact'));

        var contacts = $('.roster-area li');

        if (contacts.length > 0) {
            var inserted = false;
            contacts.each(function () {
                var cmp_pres = XMPP_client.presence_value(
                    $(this).find('.roster-contact'));
                var cmp_jid = $(this).find('.roster-jid').text();

                if (pres > cmp_pres) {
                    $(this).before(elem);
                    inserted = true;
                    return false;
                } else {
                    if (jid < cmp_jid) {
                        $(this).before(elem);
                        inserted = true;
                        return false;
                    }
                }
                return null;
            });

            if (!inserted) {
                $('.roster-area ul').append(elem);
            }
        } else {
            $('.roster-area ul').append(elem);
        }
    }
};

/*
 * Function for adding new tab -> list (tabs) of chat conversations in chat page
 * jid: Header of chat tab
 */
function makeNewTab(jid_id, jid) {
    /*
     * TODO: Replace onclick with event listener !!! -> I have some problems with this
     */
    $('#chat-area').tabs('add', '#chat-' + jid_id, "<table class='conversation-header'><tr><td class='chat-jid'>" + jid +"</td><td><span class='ui-icon ui-icon-close' onclick='removeTab(this)'>Remove Tab</span></td></tr></table>");
    $('#chat-' + jid_id).append(
        "<div class='chat-messages'></div>" +
          "<input type='text' class='chat-input'>");
    $('#chat-' + jid_id).data('jid', jid);
}

/*
 * Function for removing some conversation tab from tabs
 */
function removeTab(data){
    var header = $(data).closest("li");
    var index = $("#chat-area ul li").index(header);
    $("#chat-area").tabs("remove", index);
    $("#chat-area").tabs( "refresh" );
}

/*
 * If user is disconnected from chat disable buttons
 */
function disableButtons(){
    $("#new-contact").attr("disabled", "true");
}

/*
 * When user connect to chat enable buttons
 */
function enableButtons(){
    $("#new-contact").removeAttr("disabled");
}

/*
 *  Function for appending last messages recieved from server in the conversation with user 'jid'
 *  messages: list of messages
 *  jid: last conversation with user 
 */
function appendMessages(messages, jid){
    var jid_id = XMPP_client.jid_to_id(jid);

    if ($('#chat-' + jid_id).length === 0) {
        makeNewTab(jid_id, jid);
    }
    $('#chat-area').tabs('select', '#chat-' + jid_id);

    $('#chat-' + jid_id + ' input').focus();

    $('#chat-' + XMPP_client.jid_to_id(jid) + ' .chat-messages').empty();
    var _jid = XMPP_client.jid_to_id(jid);

    $.each(messages, function() {

        for (i in this){
            var sender = "";
            if(this[i].dir == 1)
              sender = "Me"
            else
              sender = Strophe.getNodeFromJid(jid)

            // add the new message
            $('#chat-' + _jid + ' .chat-messages').append(
                "<div class='chat-message'>" +
                  "&lt;<span class='chat-name'>" +
                  sender +
                  "</span>&gt;<span class='chat-text'>" +
                  "</span></div>");

            $('#chat-' +  _jid + ' .chat-message:last .chat-text').append(this[i].body);
        }

        XMPP_client.scroll_chat(_jid);
    });
}

/*
 * Method for getting messages for user from server
 * jid: user 
 */
function getMessages(jid){
    $.ajax({
        type: "GET",
        dataType : 'json',
        url: "/api/user-messages?user=" + jid + "/",
        success: function(reply){
            Spinner.stopSpinner();
            appendMessages(reply, jid);
        }
    });
}

/*
 * Function for setting status color
 */
function setStatusColor(value) {
    if(value == "chat")
      $(".statusColor").css('background', "#3c3");
    if(value == "away")
      $(".statusColor").css('background', 'Darkorange');
    if(value == "dnd")
      $(".statusColor").css('background', 'Red');
    if(value == "xa")
      $(".statusColor").css('background', 'Gold');
}

/*
 * Function for generating HTML for contact with given jid and name
 */
function getNewContactHtml(jid, name) {
    var jid_id = XMPP_client.jid_to_id(jid);

    return $("<li id='" + jid_id + "'>"
  + "<input type='hidden' class='jid_value' value="
  + jid +
             " /><div class='roster-contact offline'>" +
             "<div class='roster-name'>" +
             name +
             "</div><button class='btn btn-mini btn-primary roster-jid "
           + jid
           + "' type='button'>" +
             "Open chat" +
             "</button>"
           + " <button class='btn btn-mini get-inbox' id='msg|"+ jid  +"' type='button'>Recent messages</button>"
           + "</div><button class='close' id='removeContact'>&times;</button>" +
             "</li>");
}

/*
 * Function for gerring HTML for some success alert
 * text: Text to show in alert
 */
function getSuccessAlertHTML(text) {
    return $('<div class="alert alert-success"><button type="button" class="close" data-dismiss="alert">×</button>' + text  +'</div>');
}

/*
 * Function for getting HTML for modal dialog for confirmation of delete contact action
 */
function getDeleteConfirmationHtml() {

    return $('<div class="modal hide fade" id="deleteContactDialog">'
  +'<div class="modal-header">'
  +'<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>'
  +'<h3 id="confirmDeleteContact"></h3>'
  +'</div>'
  +'<div class="modal-body">'
  +'<p></p>'
  +'</div>'
  +'<div class="modal-footer">'
  +'<a href="#" id="cancelDelete" class="btn">Cancel</a>'
  +'<a href="#" id="confirmDelete" class="btn btn-primary">Delete</a>'
  +'</div>'
  +'</div>');
}

/*
 * Working with spinner
 */
var Spinner = {

    opts: {
            lines: 13, // The number of lines to draw
            length: 10, // The length of each line
            width: 2, // The line thickness
            radius: 30, // The radius of the inner circle
            corners: 1, // Corner roundness (0..1)
            rotate: 88, // The rotation offset
            color: '#000', // #rgb or #rrggbb
            speed: 1, // Rounds per second
            trail: 28, // Afterglow percentage
            shadow: false, // Whether to render a shadow
            hwaccel: false, // Whether to use hardware acceleration
            className: 'spinner', // The CSS class to assign to the spinner
            zIndex: 2e9, // The z-index (defaults to 2000000000)
            top: 'auto', // Top position relative to parent in px
            left: 'auto' // Left position relative to parent in px
    },

    spinner: new Spinner(Spinner.opts),

    /*
     * elem: Container which will contain spinner
     */
    startSpinner: function(elem) {
        var target = document.getElementById(elem);
        Spinner.spinner.spin(target);
    },

    stopSpinner: function() {
        Spinner.spinner.stop();
    }
}

/*
 * Function for making spinner
 */
function makeSpin(elem) {

    return spinner;
}

/*
 * Function for adding "No new subscribers" message to pageslide
 */
function addNoSubscribersMessage() {
    $("#user-requests-list").append("<li id='no-new-requests'><span>No new subscriptions!</span></li>");
}

$(document).ready(function () {

    /*
     * Create dialog for add new contact
     */
    $('#addContact').modal('hide');

    /*
     * Append div elements: div for displaying list of contacts, and div for displaying list od new unread messages
     */
    $("#pageslide").append('<div id="chat_window" style="display:none">'
  + '<div id=user-requests class=request-area>'
  + '<span>New subscriptions</span>'
  + '<ul id=user-requests-list></ul>'
  + '</div>'
  + '<div class="roster-area">'
  + '<span>Friends</span>'
  + '<ul>'
  + '</ul></div>'
  + '<div id=new-messages>'
  + '<span>Unread Messages</span>'
  + '<ul id=new-messages-list></ul>'
  + '</div>'
  + '</div>');

    /*
     * When user reload page, if unread messages exists, fill list with unread messages
     */
    $("#new-messages-list").html(localStorage.unreadMessages);

    /*
     * DropDown menu
     */
    $('#statusSelect').dropkick({
        change: function (value, label) {
            var status = $pres({from: XMPP_client.connection.jid}).c("show").t(value);
            XMPP_client.connection.send(status);
            localStorage.status = value;
            localStorage.statusText = label;
            setStatusColor(value);
        }
    });

    /*
     * Set the old value of DropDown -> status (online, away, etc.)
     */
    if(localStorage.status && localStorage.statusText != undefined)
    {
        $('#statusSelect').val(localStorage.status);

        $('.dk_label').text(localStorage.statusText);

        $(".dk_options_inner li").each(function(){
            $(this).removeAttr('class');
            if ($(this).text() == localStorage.statusText){
                $(this).attr('class', 'dk_option_current');
            }
        });

        setStatusColor(localStorage.status);
    }
    else{
        setStatusColor("chat");
    }

    /*
     * If the user is on chat page value is: true
     */
    var chatPage = $("#chatPage").val();

    /*
     * If number of new messages is 0
     */
    if($("#noty_number").html() == "")
    {
        $("#noty_number").removeClass("has_noty");
    }

    //Approve contact dialog
    $('#approve_dialog').modal('hide');

    $("#btnAddContact").click(function(){
        /*
         * Trigger event for adding new contact (send iq to ejabberd server)
         */
        $(document).trigger('contact_added', {
            jid: $('#contact-jid').val(),
            name: $('#contact-name').val()
        });

        $('#contact-jid').val('');
        $('#contact-name').val('');
        $('#addContact').modal('hide')
    });


    $('.chat-input').live('keypress', function (ev) {
        var jid = $(this).parent().data('jid');

        if (ev.which === 13) {
            ev.preventDefault();

            var body = $(this).val();

            var message = $msg({to: jid,
                                "type": "chat"})
                          .c('body').t(body).up()
                          .c('active', {xmlns: "http://jabber.org/protocol/chatstates"});
            XMPP_client.connection.send(message);

            $(this).parent().find('.chat-messages').append(
                "<div class='chat-message'>&lt;" +
                  "<span class='chat-name me'>" +
                  Strophe.getNodeFromJid(XMPP_client.connection.jid) +
                  "</span>&gt;<span class='chat-text'>" +
                  body +
                  "</span></div>");
            XMPP_client.scroll_chat(XMPP_client.jid_to_id(jid));

            $(this).val('');
            $(this).parent().data('composing', false);
        } else {
            var composing = $(this).parent().data('composing');
            if (!composing) {
                var notify = $msg({to: jid, "type": "chat"})
                             .c('composing', {xmlns: "http://jabber.org/protocol/chatstates"});
                XMPP_client.connection.send(notify);

                $(this).parent().data('composing', true);
            }
        }
    });


    // connect to server
    if(credentials.autenticated)
    {
        /*
         *  Change with something like this: credentials.user, credentials.pass
         */
        $(document).trigger('connect', {
            jid: credentials.user + "@localhost", /* TODO: remove hardcoded domain !!! This is only for testing purposes */
            password: "mySuperMegaPass" /* TODO: also remove harcoded pass !!! This is only for testing purposes */
        });
    }

    /*
     * Restore conversation HTML after reload page
     */
    if(typeof(Storage) != "undefined")
    {

        // if user is on chat page
        if(chatPage == "true")
        {
            sessionStorage.reload = 0;
            if(sessionStorage.chatAreaHeader != null)
            {
                $("#chat-area").empty();
                $("#chat-area ul").append(sessionStorage.chatAreaHeader);
            }

            if(sessionStorage.chatAreaContent != null)
              $("#chat-area").append(sessionStorage.chatAreaContent);

            if($.jStorage.get("selectedTab") != null)
            {
                $('#chat-area').tabs('select', $.jStorage.get("selectedTab"));
            }
        }

        else{
            sessionStorage.clear();
        }
    }

    /*
     *
     */
    $("#chat-area").on("click", "span", function() {
    });

    // make tabs widget
    $("#chat-area").tabs();


    $("#chat-area").bind("tabsselect", function(e, tab) {
        //var tmp = $('.active-chats a[href="'+ tab.tab.attr("href") +'"]');
        var jid = $(tab.tab).find(".chat-jid").html();
        $(tab.tab).closest("li").css("background-color", "white");
    });

    /*
     * Before reload page save HTML chat content to sessionStorage
     */
    $(window).bind('beforeunload',function(event){

        if($("#chat-area").tabs("length") > 0)
        {
            if(typeof(Storage) != "undefined")
            {
                if($("#chat-area ul").html() != null || $("#chat-area ul").html() != "undefined")
                  sessionStorage.chatAreaHeader = $("#chat-area ul").html();

                if($("#chat-area").html() != null || $("#chat-area").html() != "undefined")
                  sessionStorage.chatAreaContent = $("#chat-area").not("ul").html();

                sessionStorage.reload = 1;
                $.jStorage.set("selectedTab", $("#chat-area").tabs('option', 'selected'));
            }
        }

        $("#noty_number").html("");
        $("#noty_number").removeClass("has_noty");

    });


    /*
     * Disable Buttons and input box for messages before user get connected to chat
     */
    disableButtons();
    $(".chat-input").attr("disabled","disabled");

        /* ------------------------------ Event handlers -> click events ----------------------------------- */

    /*
     * Getting all messages for clicked user
     */
    $('#pageslide').on('click', '.get-inbox', function() {
        //on positoin [1] is jid of user
        var jid = $(this).attr("id").split("|");
        if(chatPage == "true")
        {
            getMessages(jid[1]);
        }

        else{
            sessionStorage.userMessage = jid[1];
            var location =  '/chat/';
            window.location.href = location;
        }
    });

    /*
     * If user click on button to remove contact, then open dialog for confirmation...
     */
    $("#pageslide").on("click", ".roster-area ul li .close", function(){

        var deleteConfirm = getDeleteConfirmationHtml();

        /*
         * DOM element to delete
         */
        var contactToDelete = $(this).closest("li");
        /*
         * Jid of contact to delete
         */
        var jidValue = $(this).parent().find(".jid_value").val();

        /*
         * Cancel deleting contact, close modal dialog
         */
        deleteConfirm.find("#cancelDelete").click(function(){
            deleteConfirm.modal("hide");
        });
        /*
         * Delete contact and close modal dialog
         */
        deleteConfirm.find("#confirmDelete").click(function(){
            contactToDelete.hide('fast', function(){
                contactToDelete.remove();
                /*
                 * Iq for deleting contact from roster (list of contacts)
                 */
                var removeContactIq = $iq({from: XMPP_client.connection.jid, type: "set"}).c("query", {xmlns: "jabber:iq:roster"})
                                      .c("item", {jid: jidValue, subscription: "remove"});
                XMPP_client.connection.send(removeContactIq);

                $("#chatAlertArea").html(getSuccessAlertHTML("You successfully deleted contact " + jidValue));
                $("#chatAlertArea div").show("slow");
                deleteConfirm.modal("hide");
            });
        });

        deleteConfirm.find("#confirmDeleteContact").html("Do you want delete contact " + Strophe.getBareJidFromJid(jidValue));
        deleteConfirm.modal("show");
    });

    /*
     * When the user click on button X in alert message, close the alert, and remove the alert from div which containing alerts
     */
    $("#chatAlertArea").on("click", ".close", function() {
        $("#chatAlertArea div").hide("fast", function() {
            $("#chatAlertArea div").remove();
        });

        return false;
    });


    /*
     * Event handler for click event on last message from some user (message in pageslide)
     */
    $("#pageslide").on("click", "#new-messages #new-messages-list li .new-message", function(){
        $(this).closest("li").hide('fast', function(){
            $(this).closest("li").remove();

            /*
             * If user is on chat page load and show message
             */
            if(chatPage == "true")
            {
                getMessages($(this).closest("li").attr("class"));
                localStorage.unreadMessages = $("#new-messages-list").html();
            }

            /*
             * Or if is not, redirect to chat page -> and then new message will be displayed
             */
            else{
                sessionStorage.userMessage = $(this).closest("li").attr("class");
                localStorage.unreadMessages = $("#new-messages-list").html();
                var location =  '/chat/';
                window.location.href = location;
            }
        });

        return false;
    });

    /*
     * If user click on X button, hide message
     */
    $("#pageslide").on("click", "#new-messages #new-messages-list li .close", function() {
        $(this).closest("li").hide('fast', function(){
            $(this).closest("li").remove();
            localStorage.unreadMessages = $("#new-messages-list").html();
        })

        return false;
    });

    /*
     * When user click on button to add new contact, open modal dialog for
     * adding new contact
     */
    $('#new-contact').click(function (ev) {
        $('#addContact').modal('show')
    });

    /*
     * Approve and add contact to contact list
     */
    $("#pageslide").on("click", "#user-requests #user-requests-list #btnApprove", function(){
        var subscriber = $(this).parent().attr("class");

        XMPP_client.connection.send($pres({
            to: subscriber,
            "type": "subscribed"}));

        XMPP_client.connection.send($pres({
            to: subscriber,
            "type": "subscribe"}));

        XMPP_client.pending_subscriber = jQuery.grep(XMPP_client.pending_subscriber, function(value) {
                                     return value != subscriber;
                                 });


        $(this).parent().hide('fast', function(){
            $(this).remove();

            if($("#user-requests-list li").size() == 0){
                addNoSubscribersMessage();
            }
        });
    });

    /*
     * Deny contact
     */
    $("#pageslide").on("click", "#user-requests #user-requests-list #btnDeny", function(){
        var subscriber = $(this).parent().attr("class");

        XMPP_client.connection.send($pres({
            to: subscriber,
            "type": "unsubscribed"}));

        $("#chatAlertArea").html(getSuccessAlertHTML("You denied contact " + subscriber));
        $("#chatAlertArea div").show("slow");

        XMPP_client.pending_subscriber = jQuery.grep(XMPP_client.pending_subscriber, function(value) {
                                     return value != subscriber;
                                 });

        $(this).parent().hide('fast', function(){
            $(this).remove();

            if($("#user-requests-list li").size() == 0){
                addNoSubscribersMessage();
            }
        });
    });

    if(sessionStorage.openChat != undefined || sessionStorage.userMessage != undefined) {
        Spinner.startSpinner("chat-area");
    }

    /*
     * When user click on contact in pageslide open conversatin in new tab
     */
    $('#pageslide').on('click', '.roster-contact', function(event) {

        var classList = $(this).find(".roster-jid").attr('class').split(/\s+/);
        var jid;
        $.each( classList, function(index, item){

            if (item.indexOf("@") != -1) {
                jid = item;
            }
        });

        if(chatPage == undefined) {
            sessionStorage.openChat = jid;
            location.href = "/chat/";
        }

        else {
            var name = $(this).find(".roster-name").text();
            var jid_id = XMPP_client.jid_to_id(jid);

            if ($('#chat-' + jid_id).length === 0) {
                makeNewTab(jid_id, jid);
            }
            $('#chat-area').tabs('select', '#chat-' + jid_id);

            $('#chat-' + jid_id + ' input').focus();
        }
    });

    /* --------------------------------------------------------------------------------------------------  */

});

/* ---------------------------------------------- Main Chat Events ---------------------------------------------------  */

$(document).bind('connect', function (ev, data) {
    var conn = new Strophe.Connection(
        'http://localhost:5280/http-bind');

    conn.connect(data.jid, data.password, function (status) {
        if (status === Strophe.Status.CONNECTED) {
            enableButtons();
            $("#connect").attr("disabled", "true");

            var iq = $iq({type: 'get'}).c('query', {xmlns: 'jabber:iq:roster'});

            $(document).trigger('connected');
        } else if (status === Strophe.Status.DISCONNECTED) {
            alert("Logout OK!");

            $(document).trigger('disconnected');
        }
    });

    XMPP_client.connection = conn;
});

$(document).bind('connected', function () {

    /*
     * When we are connected open new chat tab in chat page if this is needed
     */
    if(sessionStorage.openChat != undefined) {
        appendMessages("", sessionStorage.openChat);
        sessionStorage.removeItem("openChat");
        Spinner.stopSpinner();
    }

    $(".chat-input").removeAttr("disabled");

    /*
     * If we need to disply messages to user -> load meesages, and open conversation
     */
    if(sessionStorage.userMessage) {
        getMessages(sessionStorage.userMessage);
        sessionStorage.removeItem("userMessage");
    }

    /*
     * Pageslide initialisatino
     */
    $('#inbox_link').pageslide({
        direction: "left",
        href: '#chat_window'
    });

    if(XMPP_client.pending_subscriber.length == 0) {
        addNoSubscribersMessage();
    }

    /*
     * When the user click on message button remove noty (new messages number) if they exists
     */
    $("#noty_number").click(function(){
        $(this).removeClass("has_noty");
        $(this).html("");
    });

    /*
     * Fill list with unread messages if they exist (list in pageslide)
     */
    if(localStorage.unreadMessages){
        $("#new-messages-list").html(localStorage.unreadMessages.toString());
    }

    var iq = $iq({type: 'get'}).c('query', {xmlns: 'jabber:iq:roster'});

    XMPP_client.connection.sendIQ(iq, XMPP_client.on_roster);

    XMPP_client.connection.addHandler(XMPP_client.on_roster_changed,
                              "jabber:iq:roster", "iq", "set");

    XMPP_client.connection.addHandler(XMPP_client.on_message,
                              null, "message", "chat");

});

$(document).bind('disconnected', function () {
    XMPP_client.connection = null;
    XMPP_client.pending_subscriber = null;

    $('.roster-area ul').empty();
    $('#chat-area ul').empty();
    $('#chat-area div').remove();
});


$(document).bind('contact_added', function (ev, data) {
    var iq = $iq({type: "set"}).c("query", {xmlns: "jabber:iq:roster"})
             .c("item", data);
    XMPP_client.connection.sendIQ(iq);

    var subscribe = $pres({to: data.jid, "type": "subscribe"});
    XMPP_client.connection.send(subscribe);
});

/* ------------------------------------------------------------------------------------------------------------------ */
