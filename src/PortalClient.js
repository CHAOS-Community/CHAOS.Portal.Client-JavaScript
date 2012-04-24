if (!jQuery)
	throw "jQuery not loaded";

// ******************************** PortalClient ********************************

function PortalClient(servicePath, clientGUID, autoCreateSession)
{
	if(typeof servicePath === "undefined")
		throw "Parameter servicePath must be set";
	
	clientGUID = typeof clientGUID !== "undefined" ? clientGUID : null;
	autoCreateSession = typeof autoCreateSession !== "undefined" ? autoCreateSession : true;
	
	var _sessionCreated = new PortalEvent(this);
	var _sessionAuthenticated = new PortalEvent(this);
	
	this._SessionGUID = null;
	this._IsAuthenticated = false;
	
	if(servicePath.substr(-1) != "/")
		servicePath += "/";
	
	this.ServicePath = function() { return servicePath; };
	this.ClientGUID = function() { return clientGUID; };
	this.SessionCreated = function() { return _sessionCreated; };
	this.SessionAuthenticated = function() { return _sessionAuthenticated; };
	
	if(autoCreateSession)
		this.Session_Create();
}

PortalClient.prototype = (function()
{
	var PROTOCOL_VERSION = 4;
	var FORMAT = "jsonp";
	var USER_HTTP_STATUS_CODES = false;
	var HTTP_METHOD_POST = "POST";
	var HTTP_METHOD_GET = "GET";
	
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
				if(parameters[key] == null)
					delete parameters[key];
			}
		}

		ValidateCallback(callback);
		
		if(requiresSession)
		{
			if(this.SessionGUID() == null)
				throw "Session not created";

			parameters["sessionGUID"] = this.SessionGUID();
		}
		
		parameters.format = FORMAT;
		parameters.userHTTPStatusCodes = USER_HTTP_STATUS_CODES;

		$.ajax({
			type: httpMethod,
			url: this.ServicePath() + path,
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

		ProtocolVersion:	function() { return PROTOCOL_VERSION; },
		SessionGUID: 		function() { return this._SessionGUID; },
		IsSessionCreated:	function() { return this._SessionGUID != null; },
		IsAuthenticated: 	function() { return this._IsAuthenticated; },
		
		Session_Create:			function(callback) 
		{ 
			var self = this;

			ValidateCallback.call(this, callback);
			
			return CallService.call(this, function(serviceResult)
			{
				if(serviceResult.WasSuccess() && serviceResult.Portal() != null && serviceResult.Portal().WasSuccess())
				{
					var session = serviceResult.Portal().Results()[0];
					self._SessionGUID = session.SessionGUID;
					self.SessionCreated().Raise(session);
				}

				if(typeof callback === "function")
					callback(serviceResult);
			}, "Session/Create", HTTP_METHOD_GET, {protocolVersion: this.ProtocolVersion()}, false);
		},
		
		EmailPassword_Login:	function(callback, email, password)
		{
			var self = this;

			ValidateCallback.call(this, callback);
			
			return CallService.call(this, function(serviceResult)
			{
				if(serviceResult.WasSuccess() && serviceResult.EmailPassword() != null && serviceResult.EmailPassword().WasSuccess())
				{
					self._IsAuthenticated = true;
					self.SessionAuthenticated().Raise(serviceResult.EmailPassword().Results()[0]);
				}

				if(typeof callback === "function")
					callback(serviceResult);
			}, "EmailPassword/Login", HTTP_METHOD_GET, {email: email, password: password}, true); 
		},
		
		Folder_Get:				function(callback, id, folderTypeID, parentID)
		{ return CallService.call(this, callback, "Folder/Get", HTTP_METHOD_GET, {id: id, folderTypeID: folderTypeID, parentID: parentID}, true); },

		Object_Get:				function(callback, query, sort, pageIndex, pageSize, includeMetadata, includeFiles, includeObjectRelations)
		{
			includeMetadata = typeof includeMetadata !== 'undefined' ? includeMetadata : false;
			includeFiles = typeof includeFiles !== 'undefined' ? includeFiles : false;
			includeObjectRelations = typeof includeObjectRelations !== 'undefined' ? includeObjectRelations : false;
			return CallService.call(this, callback, "Object/Get", HTTP_METHOD_GET, {query: query, sort: sort, pageIndex: pageIndex, pageSize: pageSize, includeMetadata: includeMetadata, includeFiles: includeFiles, includeObjectRelations: includeObjectRelations}, true);
		},
		
		Object_GetByFolderID:	function(callback, folderID, includeChildFolders, pageIndex, pageSize, includeMetadata, includeFiles, includeObjectRelations)
		{ return this.Object_Get(callback, (includeChildFolders ? "(FolderTree:" : "(FolderID:") + folderID + ")", null, pageIndex, pageSize, includeMetadata, includeFiles, includeObjectRelations); },
		
		Object_GetByObjectGUID:	function(callback, objectGUID, includeMetadata, includeFiles, includeObjectRelations)
		{ return this.Object_Get(callback, "(GUID:" + objectGUID + ")", null, 0, 1, includeMetadata, includeFiles, includeObjectRelations); },
		
		StatsObject_Set:		function(repositoryIdentifier, objectIdentifier, objectTypeID, objectCollectionID, channelIdentifier, channelTypeID, eventTypeID, objectTitle, ip, city, country, userSessionID)
		{ return CallService.call(this, callback, "StatsObject/Set", HTTP_METHOD_GET, {repositoryIdentifier: repositoryIdentifier, objectIdentifier: objectIdentifier, objectTypeID: objectTypeID, objectCollectionID: objectCollectionID,
			channelIdentifier: channelIdentifier, channelTypeID: channelTypeID, eventTypeID: eventTypeID, objectTitle: objectTitle, ip: ip, city: city, country: country, userSessionID: userSessionID}, true); }
	};
})();

// ******************************** PortalEvent ********************************

function PortalEvent(sender)
{
	if (sender == undefined || sender == null)
		throw "sender must be defined";

	this._Sender = sender;
	this._Handlers = new Array();
}

PortalEvent.prototype =
{
	constructor: PortalEvent,

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

// ******************************** PortalServiceResult ********************************

function PortalServiceResult(data)
{
	var _error = null;
	var _portal = null;
	var _emailPassword = null;
	var _mcm = null;
	var _statistics = null;
	
	if(data instanceof String)
	{
		_error = data;
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
				case "Geckon.Portal":
					_portal = new PortalModuleResult(data.ModuleResults[i]);
					break;
				case "CHAOS.Portal.EmailPasswordModule.Standard.EmailPasswordModule":
					_emailPassword = new PortalModuleResult(data.ModuleResults[i]);
					break;
				case "CHAOS.MCM.Module.Standard.MCMModule":
					_mcm = new PortalModuleResult(data.ModuleResults[i]);
					break;
				case "CHAOS.Statistics.Module.Standard.StatisticsModule":
					_statistics = new PortalModuleResult(data.ModuleResults[i]);
					break;
			}
		}
	}
	
	this.Error = function() { return _error; };
	this.WasSuccess = function() { return this.Error() == null; };
	this.Portal = function() { return _portal; };
	this.EmailPassword = function() { return _emailPassword; };
	this.MCM = function() { return _mcm; };
	this.Statistics = function() { return _statistics; };
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
	this.Results = function () { return _results; };
}