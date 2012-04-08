if (!jQuery)
	throw "jQuery not loaded";

// ******************************** Event ********************************

function Event(sender)
{
	if (sender == undefined || sender == null)
		throw "sender must be defined";

	this._Sender = sender;
	this._Handlers = new Array();
}

Event.prototype =
{
	constructor: Event,

	Add: function (handler)
	{
		if (handler == undefined || handler == null)
			throw "handler must be defined";

		this._Handlers.push(handler);
	},

	Remove: function (handler)
	{
		if (handler == undefined || handler == null)
			throw "handler must be defined";

		for (i = 0; i <= this._Handlers.length; i++)
		{
			if (this._Handlers[i] === handler)
				this._Handlers.splice(i, 1);
		}

	},

	Raise: function (data)
	{
		for (i = 0; i < this._Handlers.length; i++)
			this._Handlers[i](this._Sender, data);
	}
};

// ******************************** PortalClient ********************************

function PortalClient(servicePath)
{
	this.SessionCreated = new Event(this);
	this.SessionAuthenticated = new Event(this); //Data is authentication type.

	this.AuthenticationType = this.AUTHENTICATION_TYPE_NONE;
	this.Session = null;
	this.ServicePath = servicePath == undefined ? null : servicePath;
}

PortalClient.prototype =
{
	constructor: PortalClient,

	AUTHENTICATION_TYPE_NONE: 0,
	AUTHENTICATION_TYPE_EMAIL: 1,
	AUTHENTICATION_TYPE_SECURE_COOKIE: 2,
	PROTOCOL_VERSION: 3,
	COOKIE_LIFETIME_DAYS: 30,
	CHANGE_PASSWORD_REQUEST_TOKEN_KEY: "passwordTicket",
	CHANGE_PASSWORD_REQUEST_TOKEN: "$Token$",

	IsServicePathSet: function () { return this.ServicePath != null; },
	ValidateServicePathIsSet: function () { if (!this.IsServicePathSet()) throw "ServicePath is not set"; },
	HasSession: function () { return this.Session != null; },
	GetSessionID: function () { return this.HasSession() ? this.Session.SessionID : null; },
	ValidateSessionAquired: function () { if (!this.HasSession()) throw "Session not Aquired"; },
	IsSessionAuthenticated: function () { return this.AuthenticationType != this.AUTHENTICATION_TYPE_NONE; },
	ValidateSessionAuthenticated: function () { if (!this.IsSessionAuthenticated) throw "Session not authenticated"; },
	HasSecureCookie: function () { return this.GetSecureCookie() != null; },

	GetModuleResult: function (data, fullName)
	{
		for (var i = 0; i < data.ModuleResults.length; i++)
		{
			var moduleResult = data.ModuleResults[i];
			if (moduleResult.Fullname == fullName)
				return moduleResult.Results;
		}
		return null;
	},

	IsNotException: function (data)
	{
		return typeof (data) != 'string' && (data.Fullname == null || data.Fullname.indexOf("Exception") == -1); //If input is a string and not Object (JSON) it must be a error message.
	},

	ReportResult: function (callback, data, importantModules)
	{
		var success = this.IsNotException(data);

		if (success && importantModules != null)
		{
			for (var i = 0; i < importantModules.length; i++)
			{
				var moduleResult = this.GetModuleResult(data, importantModules[i]);

				success = moduleResult != null && (moduleResult.length == 0 || this.IsNotException(moduleResult[0]));

				if (!success)
					break;
			}
		}

		if (callback != null)
			callback(success, data);

		return success;
	},

	SetSession: function (session)
	{
		this.Session = session;
		this.SessionCreated.Raise(session);
	},

	SetAuthenticated: function (type)
	{
		this.AuthenticationType = type;
		this.SessionAuthenticated.Raise(type);
	},

	//********************** Extensions **********************

	EmailPasswordLogin: function (email, password, callback)
	{
		this.ValidateSessionAquired();
		var client = this; //Used for method closure

		$.get(this.ServicePath + "/EmailPassword/Login", { format: "jsonp", useHTTPStatusCodes: false, sessionID: this.GetSessionID(), email: email, password: password },
			function (data, textStatus, jqXHR)
			{
				if (client.ReportResult(callback, data, ["Geckon.Portal.CHAOS.EmailPasswordModule.Standard.EmailPasswordModule"]))
					client.SetAuthenticated(client.AUTHENTICATION_TYPE_EMAIL);
			}, "jsonp")
			.error(function (request, error, message) { client.ReportResult(callback, message); });
	},

	EmailPasswordChangePassword: function (ticketGUID, callback)
	{
		this.ValidateSessionAquired();
		var client = this; //Used for method closure

		if (ticketGUID == null)
		{
			var regex = new RegExp("#.*\?(?:.*&)?" + this.CHANGE_PASSWORD_REQUEST_TOKEN_KEY + "=([0-9a-fA-F\-]+)(?=$|&)", "");

			var match = regex.exec(location.href);

			if (match == null)
			{
				this.ReportResult(callback, "No ticket in querystring");
				return;
			}

			ticketGUID = match[1];

			location = location.href.replace(new RegExp(this.CHANGE_PASSWORD_REQUEST_TOKEN_KEY + "=" + ticketGUID + "&?", ""), "").replace(new RegExp("&$", ""), "");
		}

		$.get(this.ServicePath + "/EmailPassword/ChangePassword", { format: "jsonp", useHTTPStatusCodes: false, sessionID: this.GetSessionID(), ticketGUID: ticketGUID },
			function (data, textStatus, jqXHR) { client.ReportResult(callback, data, ["Geckon.Portal.CHAOS.EmailPasswordModule.Standard.EmailPasswordModule"]); }, "jsonp")
			.error(function (request, error, message) { client.ReportResult(callback, message); });
	},

	EmailPasswordChangePasswordRequest: function (email, password, url, callback)
	{
		this.ValidateSessionAquired();
		var client = this; //Used for method closure

		if (url == null)
		{
			url = location.href;

			var hashPosition = url.indexOf("#"); // Don't tell the police ;)

			if (hashPosition == -1)
				url += "#?";
			else if (hashPosition == url.length - 1)
				url += "?";
			else if (!(hashPosition == url.length - 2 && url.charAt(url.length - 1) == "?"))
				url += "&";

			url += this.CHANGE_PASSWORD_REQUEST_TOKEN_KEY + "=" + this.CHANGE_PASSWORD_REQUEST_TOKEN;
		}

		$.get(this.ServicePath + "/EmailPassword/ChangePasswordRequest", { format: "jsonp", useHTTPStatusCodes: false, sessionID: this.GetSessionID(), email: email, password: password, url: url },
			function (data, textStatus, jqXHR) { client.ReportResult(callback, data, ["Geckon.Portal.CHAOS.EmailPasswordModule.Standard.EmailPasswordModule"]); }, "jsonp")
			.error(function (request, error, message) { client.ReportResult(callback, message); });
	},

	SecureCookieCreate: function (callback)
	{
		this.ValidateSessionAuthenticated();
		var client = this; //Used for method closure

		$.get(this.ServicePath + "/SecureCookie/Create", { format: "jsonp", useHTTPStatusCodes: false, sessionID: this.GetSessionID() },
			function (data, textStatus, jqXHR) { client.ReportResult(callback, data, ["Geckon.Portal.CHAOS.SecureCookieModule.Standard.SecureCookieModule"]); }, "jsonp")
			.error(function (request, error, message) { client.ReportResult(callback, message); });
	},

	SecureCookieLogin: function (callback, guid, passwordGUID)
	{
		this.ValidateSessionAquired();
		var client = this; //Used for method closure

		$.get(this.ServicePath + "/SecureCookie/Login", { format: "jsonp", useHTTPStatusCodes: false, sessionID: this.GetSessionID(), guid: guid, passwordGUID: passwordGUID },
			function (data, textStatus, jqXHR)
			{
				if (client.ReportResult(callback, data, ["Geckon.Portal.CHAOS.SecureCookieModule.Standard.SecureCookieModule"]))
					client.SetAuthenticated(client.AUTHENTICATION_TYPE_SECURE_COOKIE);
			}, "jsonp")
			.error(function (request, error, message) { client.ReportResult(callback, message); });
	},

	SessionCreate: function (callback)
	{
		this.ValidateServicePathIsSet();

		var client = this; //Used for method closure

		$.get(this.ServicePath + "/Session/Create", { format: "jsonp", useHTTPStatusCodes: false, protocolVersion: this.PROTOCOL_VERSION },
			function (data, textStatus, jqXHR)
			{
				if (client.IsNotException(data))
					client.SetSession(client.GetModuleResult(data, "Geckon.Portal")[0]); //Set session before callback so callback can call another service function.

				client.ReportResult(callback, data)
			}, "jsonp")
			.error(function (request, error, message) { client.ReportResult(callback, message); });
	},

	ObjectGet: function (callback, query, sort, includeMetadata, includeFiles, includeObjectRelations, pageIndex, pageSize)
	{
		this.ValidateSessionAquired();
		var client = this; //Used for method closure

		$.get(this.ServicePath + "/Object/Get", { format: "jsonp", useHTTPStatusCodes: false, sessionID: this.GetSessionID(),
			query: query, sort: sort, includeMetadata: includeMetadata, includeFiles: includeFiles, includeObjectRelations: includeObjectRelations, pageIndex: pageIndex, pageSize: pageSize},
			function (data, textStatus, jqXHR) { client.ReportResult(callback, data, ["Geckon.MCM.Module.Standard.MCMModule"]); }, "jsonp")
			.error(function (request, error, message) { client.ReportResult(callback, message); });
	},

	//********************** Helper functions **********************
	
	GetObjectByGUID: function (callback, GUID) 
	{
		this.ObjectGet(callback, "GUID:" + GUID, null, true, true, true, 0, 1);
	},

	LoginWhenSessionIsAvailable: function (email, password, callback)
	{
		var client = this; //Used for method closure

		if (this.HasSession())
			this.EmailPasswordLogin(email, password, callback);
		else
			this.SessionCreated.Add(function (sender, data) { client.LoginWhenSessionIsAvailable(email, password, callback); });
	},

	LoginWithSecureCookieWhenSessionIsAvailable: function (callback)
	{
		var client = this; //Used for method closure

		if (this.HasSession())
		{
			if (!this.HasSecureCookie())
				callback(false, "No SecureCookie");
			
			this.LoginWithSecureCookie(callback);
		}
		else
			this.SessionCreated.Add(function (sender, data) { client.LoginWithSecureCookie(callback); });
	},

	LoginWithSecureCookie: function (callback)
	{
		this.ValidateSessionAquired();

		var cookie = this.GetSecureCookie();

		if (cookie == null)
		{
			callback(false, "No SecureCookie");
			return;
		}

		var client = this; //Used for method closure

		this.SecureCookieLogin(function (success, data)
		{
			if (success)
			{
				var secureCookie = client.GetModuleResult(data, "Geckon.Portal.CHAOS.SecureCookieModule.Standard.SecureCookieModule")[0];

				client.SetSecureCookie(secureCookie.GUID, secureCookie.PasswordGUID);
			}

			callback(success, data);
		}, cookie.GUID, cookie.PasswordGUID);
	},

	CreateAndSaveSecureCookie: function ()
	{
		this.ValidateSessionAuthenticated()

		if (this.AuthenticationType == this.AUTHENTICATION_TYPE_SECURE_COOKIE) //No need to save cookie if we logged in with cookie.
			return;

		var client = this; //Used for method closure

		this.SecureCookieCreate(function (success, data)
		{
			if (!success)
				return;

			var secureCookie = client.GetModuleResult(data, "Geckon.Portal.CHAOS.SecureCookieModule.Standard.SecureCookieModule")[0];

			client.SetSecureCookie(secureCookie.GUID, secureCookie.PasswordGUID);
		});
	},

	ClearSecureCookie: function ()
	{
		var expiredate = new Date();
		expiredate.setDate(expiredate.getDate() - 2);
		document.cookie = "SecureCookieGUID=; expires=" + expiredate.toUTCString() + ";";
		document.cookie = "SecureCookieGUIDPassword=; expires=" + expiredate.toUTCString() + ";";
	},

	SetSecureCookie: function (guid, passwordGUID)
	{
		var expiredate = new Date();
		expiredate.setDate(expiredate.getDate() + client.COOKIE_LIFETIME_DAYS);

		document.cookie = "SecureCookieGUID=" + guid + "; expires=" + expiredate.toUTCString() + ";";
		document.cookie = "SecureCookieGUIDPassword=" + passwordGUID + "; expires=" + expiredate.toUTCString() + ";";
	},

	GetSecureCookie: function ()
	{
		var cookie = document.cookie;

		if (cookie == undefined || cookie == null)
			return null;

		var guidRegEx = /SecureCookieGUID\=(.+?)(?:;|$)/;
		var passwordRegex = /SecureCookieGUIDPassword\=(.+?)(?:;|$)/;

		var result = {};
		var match = guidRegEx.exec(cookie);

		if (match == null)
			return null;

		result.GUID = match[1];

		match = passwordRegex.exec(cookie);

		if (match == null)
			return null;

		result.PasswordGUID = match[1];

		return result;
	}
}