if (!jQuery)
	throw "jQuery not loaded";

// ******************************** PortalClient ********************************

function PortalClient(servicePath, clientGUID, autoCreateSession)
{
	if(typeof servicePath === "undefined")
		throw "Parameter servicePath must be set";

	if(new RegExp("/v\\d+(?:/|$)").test(servicePath))
		throw "Protocol version should not be part of service path";
	
	clientGUID = typeof clientGUID !== "undefined" ? clientGUID : null;
	autoCreateSession = typeof autoCreateSession !== "undefined" ? autoCreateSession : true;
	
	var _sessionAcquired = new PortalEvent(this);
	var _sessionAuthenticated = new PortalEvent(this);
	
	this._SessionGUID = null;
	this._IsSessionAuthenticated = false;
	
	if(servicePath.substr(-1) != "/")
		servicePath += "/";
	
	this.ServicePath = function() { return servicePath; };
	this.ClientGUID = function() { return clientGUID; };
	this.SessionAcquired = function() { return _sessionAcquired; };
	this.SessionAuthenticated = function() { return _sessionAuthenticated; };
	
	if(autoCreateSession)
		this.Session_Create();
	
	var pluginInitializers = PortalClient.GetPluginInitializerFunctions();
	for(var i = 0; i < pluginInitializers.length; i++)
	{
		var initializeResult = pluginInitializers[i].call(this);
		
		for(key in initializeResult)
		{
			if(typeof this[key] !== "undefined")
				throw "Plugin tried overwrite existing property: " + key;
			
			this[key] = initializeResult[key];
		}
	}
}

PortalClient._pluginInitializerFunctions = new Array();
PortalClient.GetPluginInitializerFunctions = function() { return this._pluginInitializerFunctions; };
PortalClient.RegisterPlugin = function(initializerFunction) { this._pluginInitializerFunctions.push(initializerFunction); };

PortalClient.prototype = (function()
{
	var CLIENT_VERSION = "1.2.0";
	var PROTOCOL_VERSION = 4;
	var FORMAT = "jsonp";
	var USER_HTTP_STATUS_CODES = false;
	var HTTP_METHOD_POST = "POST";
	var HTTP_METHOD_GET = "GET";
	var AUTHENTICATION_METHOD_EMAIL_PASSWORD = "EmailPassword";
	var AUTHENTICATION_METHOD_SECURE_COOKIE = "SecureCookie";
	var AUTHENTICATION_METHOD_EXTERNAL = "External";
	
	function CallService(callback, path, httpMethod, parameters, requiresSession)
	{
		if(arguments.length < 5)
			requiresSession = true;
		if(arguments.length < 4 || parameters == null)
			parameters = {};
		else
		{
			for(key in parameters)
			{
				if(parameters[key] == null || typeof parameters[key] === 'undefined')
					delete parameters[key];
			}
		}

		ValidateCallback(callback);
		
		if(requiresSession)
		{
			if(!this.HasSession())
				throw "Session not acquired";

			parameters["sessionGUID"] = this.SessionGUID();
		}
		
		parameters.format = FORMAT;
		parameters.userHTTPStatusCodes = USER_HTTP_STATUS_CODES;

		$.ajax({
			type: httpMethod,
			url: this.ServicePath() + "v" + PROTOCOL_VERSION + "/" + path,
			data: parameters,
			success: function (data, textStatus, jqXHR)
			{
				if(typeof callback === "function")
					callback(new PortalServiceResult(data));
			},
			dataType: "jsonp"
		}).error(function (request, error, message) 
		{
			if(typeof callback === "function")
				callback(new PortalServiceResult(message));
		});
	}
	
	function ValidateCallback(callback)
	{
		if(typeof callback !== "function" && typeof callback !== "undefined" && callback !== null)
			throw "Parameter callback must a function, null or undefined";
	}
	
	return {
		constructor: PortalClient,

		ClientVersion:						function() { return CLIENT_VERSION; },
		ProtocolVersion:					function() { return PROTOCOL_VERSION; },
		AuthenticationMethodEmailPassword:	function() { return AUTHENTICATION_METHOD_EMAIL_PASSWORD; },
		AuthenticationMethodSecureCookie:	function() { return AUTHENTICATION_METHOD_SECURE_COOKIE; },
		AuthenticationMethodExternal:		function() { return AUTHENTICATION_METHOD_EXTERNAL; },
		SessionGUID: 						function() { return this._SessionGUID; },
		HasSession:							function() { return this._SessionGUID != null; },
		IsSessionAuthenticated: 			function() { return this._IsSessionAuthenticated; },
		
		SetSessionGUID:			function(guid, isAuthenticated)
		{
			if(!guid)
				throw "Parameter guid not valid";
			
			this._SessionGUID = guid;
			this.SessionAcquired().Raise(guid);
			
			if(isAuthenticated)
				this.SessionAuthenticated().Raise(AUTHENTICATION_METHOD_EXTERNAL)
		},
		
		Session_Create:			function(callback) 
		{ 
			var self = this;

			ValidateCallback.call(this, callback);
			
			CallService.call(this, function(serviceResult)
			{
				if(serviceResult.WasSuccess() && serviceResult.Portal() != null && serviceResult.Portal().WasSuccess())
					self.SetSessionGUID(serviceResult.Portal().Results()[0].SessionGUID);

				if(typeof callback === "function")
					callback(serviceResult);
			}, "Session/Create", HTTP_METHOD_GET, {protocolVersion: this.ProtocolVersion()}, false);
		},
		
		EmailPassword_Login:	function(callback, email, password)
		{
			ValidateCallback.call(this, callback);

			var self = this;
			
			CallService.call(this, function(serviceResult)
			{
				if(serviceResult.WasSuccess() && serviceResult.EmailPassword() != null && serviceResult.EmailPassword().WasSuccess())
				{
					self._IsSessionAuthenticated = true;
					self.SessionAuthenticated().Raise(AUTHENTICATION_METHOD_EMAIL_PASSWORD);
				}

				if(typeof callback === "function")
					callback(serviceResult);
			}, "EmailPassword/Login", HTTP_METHOD_GET, {email: email, password: password}, true); 
		},

		SecureCookie_Create:	function(callback)
		{ CallService.call(this, callback, "SecureCookie/Create", HTTP_METHOD_GET, null, true); },

		SecureCookie_Delete:	function(callback, guids)
		{ throw "Method not implemented"; },

		SecureCookie_Login:		function(callback, guid, passwordGUID )
		{
			ValidateCallback.call(this, callback);

			var self = this;
			
			CallService.call(this, function(serviceResult)
			{
				if(serviceResult.WasSuccess() && serviceResult.SecureCookie() != null && serviceResult.SecureCookie().WasSuccess())
				{
					self._IsSessionAuthenticated = true;
					self.SessionAuthenticated().Raise(AUTHENTICATION_METHOD_SECURE_COOKIE);
				}

				if(typeof callback === "function")
					callback(serviceResult);
			}, "SecureCookie/Login", HTTP_METHOD_GET, {guid: guid, passwordGUID: passwordGUID}, true);
		},
		
		Folder_Get:				function(callback, id, folderTypeID, parentID)
		{ CallService.call(this, callback, "Folder/Get", HTTP_METHOD_GET, {id: id, folderTypeID: folderTypeID, parentID: parentID}, true); },

		MetadataSchema_Get:		function(callback, metadataSchemaGUID)
		{ CallService.call(this, callback, "MetadataSchema/Get", HTTP_METHOD_GET, {metadataSchemaGUID: metadataSchemaGUID}, true); },

		Object_Create:		function(callback, guid, objectTypeID, folderID )
		{ CallService.call(this, callback, "Object/Create", HTTP_METHOD_GET, {guid: guid, objectTypeID: objectTypeID, folderID: folderID}, true); },

		Object_Get:				function(callback, query, sort, accessPointGUID, pageIndex, pageSize, includeMetadata, includeFiles, includeObjectRelations, includeAccessPoints)
		{
			includeMetadata = typeof includeMetadata !== 'undefined' ? includeMetadata : false;
			includeFiles = typeof includeFiles !== 'undefined' ? includeFiles : false;
			includeObjectRelations = typeof includeObjectRelations !== 'undefined' ? includeObjectRelations : false;
			includeAccessPoints = typeof includeAccessPoints !== 'undefined' ? includeAccessPoints : false;
			CallService.call(this, callback, "Object/Get", HTTP_METHOD_GET, {query: query, sort: sort, accessPointGUID: accessPointGUID, pageIndex: pageIndex, pageSize: pageSize, includeMetadata: includeMetadata, includeFiles: includeFiles, includeObjectRelations: includeObjectRelations}, true);
		},
		
		Object_GetByFolderID:	function(callback, folderID, includeChildFolders, sort, accessPointGUID, pageIndex, pageSize, includeMetadata, includeFiles, includeObjectRelations, includeAccessPoints)
		{ this.Object_Get(callback, (includeChildFolders ? "(FolderTree:" : "(FolderID:") + folderID + ")", sort, accessPointGUID, pageIndex, pageSize, includeMetadata, includeFiles, includeObjectRelations, includeAccessPoints); },
		
		Object_GetByObjectGUID:	function(callback, objectGUID, accessPointGUID, includeMetadata, includeFiles, includeObjectRelations, includeAccessPoints)
		{ this.Object_Get(callback, "(GUID:" + objectGUID + ")", null, accessPointGUID, 0, 1, includeMetadata, includeFiles, includeObjectRelations, includeAccessPoints); },

		Object_GetBySearch:	function(callback, searchString, schemas, langCode, sort, accessPointGUID, pageIndex, pageSize, includeMetadata, includeFiles, includeObjectRelations, includeAccessPoints)
		{
			var schemaStrings = [];
			for (i in schemas) {
				schemaStrings[i] = "m" + schemas[i] + "_" + langCode + "_all" + ":" + "(" + searchString + ")";
			}
			var query = schemaStrings.join(" ");

			this.Object_Get(callback, query, sort, accessPointGUID, pageIndex, pageSize, includeMetadata, includeFiles, includeObjectRelations, includeAccessPoints);
		},
		
		Object_SetPublishSettings: function(callback, objectGUID, accessPointGUID, startDate, endDate)
		{ CallService.call(this, callback, "Object/SetPublishSettings", HTTP_METHOD_GET, {objectGUID: objectGUID, accessPointGUID: accessPointGUID, startDate: startDate, endDate: endDate}, true); },
		
		Metadata_Set: 			function(callback, objectGUID, metadataSchemaGUID, languageCode, revisionID, metadataXML )
		{ CallService.call(this, callback, "Metadata/Set", HTTP_METHOD_GET, {objectGUID: objectGUID, metadataSchemaGUID: metadataSchemaGUID, languageCode: languageCode, revisionID: revisionID, metadataXML: metadataXML}, true); },

		StatsObject_Set:		function(callback, repositoryIdentifier, objectIdentifier, objectTypeID, objectCollectionID, channelIdentifier, channelTypeID, eventTypeID, objectTitle, ip, city, country, userSessionID)
		{ CallService.call(this, callback, "StatsObject/Set", HTTP_METHOD_GET, {repositoryIdentifier: repositoryIdentifier, objectIdentifier: objectIdentifier, objectTypeID: objectTypeID, objectCollectionID: objectCollectionID, channelIdentifier: channelIdentifier, channelTypeID: channelTypeID, eventTypeID: eventTypeID, objectTitle: objectTitle, IP: ip, city: city, country: country, userSessionID: userSessionID}, true); },

		Upload_Initiate: function(callback, objectGUID, FormatTypeID , fileSize, supportMultipleChunks)
		{
			supportMultipleChunks = typeof supportMultipleChunks !== 'undefined' ? supportMultipleChunks : false;
			CallService.call(this, callback, "Upload/Initiate", HTTP_METHOD_GET, {objectGUID: objectGUID, formatTypeID : FormatTypeID , fileSize: fileSize, supportMultipleChunks: supportMultipleChunks}, true);
		}
	};
})();

// ******************************** PortalEvent ********************************

function PortalEvent(sender)
{
	if (sender == undefined || sender == null)
		throw "sender must be defined";

	this._Sender = sender;
	this._Handlers = new Array();
	this._Raised = false;
	this._Data = null;
}

PortalEvent.prototype =
{
	constructor: PortalEvent,

	Add: function (handler)
	{
		if (handler == undefined || handler == null)
			throw "handler must be defined";

		if (this._Raised) {
			handler(this._Sender, this._Data);
		}
		else
		{
			this._Handlers.push(handler);
		}
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
		this._Raised = true;
		this._Data = data;

		for (i = 0; i < this._Handlers.length; i++)
			this._Handlers[i](this._Sender, data);
	}
};

// ******************************** PortalServiceResult ********************************

function PortalServiceResult(data)
{
	var _error = null;
	var _portal = null;
	var _emailPassword = null;
	var _secureCookie = null;
	var _mcm = null;
	var _statistics = null;
	var _upload = null;

	if(data instanceof String)
	{
		_error = data;
	}
	else if(data instanceof Error)
	{
		_error = data.message;
	}
	else if(data.ModuleResults.length == 1 && data.ModuleResults[0].Fullname.indexOf("Exception") != -1)
	{
		_error = data.ModuleResults[0].Message;
	}
	
	if(_error == null)
	{
		for(var i = 0; i < data.ModuleResults.length; i++)
		{
			switch(data.ModuleResults[i].Fullname)
			{
				case "Portal":
					_portal = new PortalModuleResult(data.ModuleResults[i]);
					break;
				case "EmailPassword":
					_emailPassword = new PortalModuleResult(data.ModuleResults[i]);
					break;
				case "SecureCookie":
					_secureCookie = new PortalModuleResult(data.ModuleResults[i]);
					break;
				case "MCM":
					_mcm = new PortalModuleResult(data.ModuleResults[i]);
					break;
				case "Statistics":
					_statistics = new PortalModuleResult(data.ModuleResults[i]);
					break;
				case "Upload":
					_upload = new PortalModuleResult(data.ModuleResults[i]);
					break;
			}
		}
	}
	
	this.Error = function() { return _error; };
	this.WasSuccess = function() { return this.Error() == null; };
	this.Portal = function() { return _portal; };
	this.EmailPassword = function() { return _emailPassword; };
	this.SecureCookie = function() { return _secureCookie; };
	this.MCM = function() { return _mcm; };
	this.Statistics = function() { return _statistics; };
	this.Upload = function() { return _upload; };
}

// ******************************** PortalModuleResult ********************************

function PortalModuleResult(data)
{
	var _results = null;
	var _error = null;

	if(data.Results.length == 1 && typeof data.Results[0].Fullname != "undefined" && data.Results[0].Fullname.indexOf("Exception") != -1)
	{
		_error = data.Results[0].Message;
	}
	else
	{
		_results = data.Results;
	}

	this.Error = function() { return _error; };
	this.WasSuccess = function() { return this.Error() == null; };
	this.Results = function() { return _results; };
	this.TotalCount = function() { return data.TotalCount; }
	this.Count = function() { return data.Count; }
}
