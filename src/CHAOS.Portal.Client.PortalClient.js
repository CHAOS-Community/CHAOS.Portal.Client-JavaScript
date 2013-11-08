/**
 * CHAOS.Portal.Client-Javascript
 *
 * @description Webclient for CHAOS' Portal webservice
 * @repo https://github.com/CHAOS-Community/CHAOS.Portal.Client-JavaScript
 */

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
	                            var CLIENT_VERSION = "1.2.1";
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

                                  /**
                                   * SetSessionGUID
                                   *
                                   * @param guid
                                   * @param isAuthenticated
                                   */
		                              SetSessionGUID:	function(guid, isAuthenticated)
		                              {
			                                if(!guid)
				                                  throw "Parameter guid not valid";

			                                this._SessionGUID = guid;
			                                this.SessionAcquired().Raise(guid);

			                                if(isAuthenticated)
				                                  this.SessionAuthenticated().Raise(AUTHENTICATION_METHOD_EXTERNAL)
		                              },

                                  /**
                                   * Session_Create
                                   *
                                   * @param callback
                                   */
		                              Session_Create:	function(callback)
		                              {
			                                ValidateCallback.call(this, callback);

			                                var self = this;

			                                CallService.call(this, function(serviceResult)
			                                                 {
				                                                   if(serviceResult.WasSuccess() &&
                                                              serviceResult.Portal() != null &&
                                                              serviceResult.Portal().WasSuccess())
					                                                     self.SetSessionGUID(serviceResult.Portal().Results()[0].SessionGUID);

				                                                   if(typeof callback === "function")
					                                                     callback(serviceResult);

			                                                 }, "Session/Create", HTTP_METHOD_GET, { protocolVersion: this.ProtocolVersion() }, false);
		                              },

                                  /**
                                   * EmailPassword_Login
                                   *
                                   * @param callback
                                   * @param args {
                                   * , email
                                   * , password
                                   * }
                                   */
		                              EmailPassword_Login: function(callback, args)
		                              {
			                                ValidateCallback.call(this, callback);

			                                var self = this;

			                                CallService.call(this, function(serviceResult)
			                                                 {
				                                                   if(serviceResult.WasSuccess() &&
                                                              serviceResult.EmailPassword() != null &&
                                                              serviceResult.EmailPassword().WasSuccess())
				                                                   {
					                                                     self._IsSessionAuthenticated = true;
					                                                     self.SessionAuthenticated().Raise(AUTHENTICATION_METHOD_EMAIL_PASSWORD);
				                                                   }

				                                                   if(typeof callback === "function")
					                                                     callback(serviceResult);

			                                                 }, "EmailPassword/Login", HTTP_METHOD_GET, args, true);
		                              },

                                  /**
                                   * SecureCookie_Create
                                   *
                                   * @param callback
                                   */
		                              SecureCookie_Create: function(callback)
		                              {
                                      CallService.call(this, callback, "SecureCookie/Create", HTTP_METHOD_GET, null, true);
                                  },

		                              SecureCookie_Delete: function(callback, guids) { throw "Method not implemented"; },

                                  /**
                                   * SecureCookie_Login
                                   *
                                   * @param callback
                                   * @param args {
                                   * , guid
                                   * , passwordGUID
                                   * }
                                   */
		                              SecureCookie_Login:	function(callback, args)
		                              {
			                                ValidateCallback.call(this, callback);

			                                var self = this;

			                                CallService.call(this, function(serviceResult)
			                                                 {
				                                                   if(serviceResult.WasSuccess() &&
                                                              serviceResult.SecureCookie() != null &&
                                                              serviceResult.SecureCookie().WasSuccess())
				                                                   {
					                                                     self._IsSessionAuthenticated = true;
					                                                     self.SessionAuthenticated().Raise(AUTHENTICATION_METHOD_SECURE_COOKIE);
				                                                   }

				                                                   if(typeof callback === "function")
					                                                     callback(serviceResult);

			                                                 }, "SecureCookie/Login", HTTP_METHOD_GET, args, true);
		                              },

                                  /**
                                   * Folder_Get
                                   *
                                   * @param callback
                                   * @param args {
                                   * , id
                                   * , folderTypeID
                                   * , parentID
                                   * }
                                   */
		                              Folder_Get:	function(callback, args)
		                              {
                                      CallService.call(this, callback, "Folder/Get", HTTP_METHOD_GET, args, true);
                                  },

                                  /**
                                   * MetadataSchema_Get
                                   *
                                   * @param callback
                                   * @param args {
                                   * , metadataSchemaGUID
                                   * }
                                   */
		                              MetadataSchema_Get:	function(callback, args)
		                              {
                                      CallService.call(this, callback, "MetadataSchema/Get", HTTP_METHOD_GET, args, true);
                                  },

                                  /**
                                   * Object_Create
                                   *
                                   * @param callback
                                   * @param args {
                                   * , guid
                                   * , objectTypeID
                                   * , folderID
                                   * }
                                   */
		                              Object_Create:		function(callback, args)
		                              {
                                      CallService.call(this, callback, "Object/Create", HTTP_METHOD_GET, args, true);
                                  },

                                  /**
                                   * Object_Get
                                   *
                                   * @param callback
                                   * @param args {
                                   * , query
                                   * , sort
                                   * , accessPointGUID
                                   * , pageIndex
                                   * , pageSize
                                   * , includeMetadata
                                   * , includeFiles
                                   * , includeObjectRelations
                                   * , includeAccessPoints
                                   * }
                                   */
		                              Object_Get: function(callback, args)
		                              {
			                                args['includeMetadata'] = typeof args['includeMetadata'] !== 'undefined' ? args['includeMetadata'] : false;
			                                args['includeFiles'] = typeof args['includeFiles'] !== 'undefined' ? args['includeFiles'] : false;
			                                args['includeObjectRelations'] = typeof args['includeObjectRelations'] !== 'undefined' ? args['includeObjectRelations'] : false;
			                                args['includeAccessPoints'] = typeof args['includeAccessPoints'] !== 'undefined' ? args['includeAccessPoints'] : false;

			                                CallService.call(this, callback, "Object/Get", HTTP_METHOD_GET, args, true);
		                              },

                                  /**
                                   * Object_GetByFolderID
                                   *
                                   * @param callback
                                   * @param args {
                                   * , folderID
                                   * , includeChildFolders
                                   * , sort
                                   * , accessPointGUID
                                   * , pageIndex
                                   * , pageSize
                                   * , includeMetadata
                                   * , includeFiles
                                   * , includeObjectRelations
                                   * , includeAccessPoints
                                   * }
                                   */
		                              Object_GetByFolderID:	function(callback, args) // TODO: Test
		                              {
                                      args['query'] = (args['includeChildFolders'] ? "(FolderTree: " : "(FolderID: ") + args['folderID'] + ")";
                                      this.Object_Get(callback, args);
                                  },

                                  /**
                                   * Object_GetByObjectGUID
                                   *
                                   * @param callback
                                   * @param args {
                                   * , objectGUID
                                   * , accessPointGUID
                                   * , includeMetadata
                                   * , includeFiles
                                   * , includeObjectRelations
                                   * , includeAccessPoints
                                   * }
                                   */
		                              Object_GetByObjectGUID:	function(callback, args)
		                              {
                                      args['query'] = "(GUID:" + args.objectGUID + ")";
                                      this.Object_Get(callback, args);
                                  },

                                  /**
                                   * Object_GetBySearch
                                   *
                                   * @param callback
                                   * @param args {
                                   * , searchString
                                   * , schemas
                                   * , langCode
                                   * , sort
                                   * , accessPointGUID
                                   * , pageIndex
                                   * , pageSize
                                   * , includeMetadata
                                   * , includeFiles
                                   * , includeObjectRelations
                                   * , includeAccessPoints
                                   * }
                                   */
		                              Object_GetBySearch:	function(callback, args)
		                              {
                                      if (typeof args['schemas'] === 'string') { args['schemas'] = [args['schemas']]; }
			                                var schemaStrings = [];
			                                for (i in args['schemas']) {
				                                  schemaStrings[i] = "m" + args['schemas'][i] + "_" + args['langCode'] + "_all" + ":" + "(" + args['query'] + ")";
			                                }
			                                args['query'] = schemaStrings.join(" ");

			                                this.Object_Get(callback, args);
		                              },

                                  /**
                                   * Object_SetPublishSettings
                                   *
                                   * @param callback
                                   * @param args {
                                   * , objectGUID
                                   * , accessPointGUID
                                   * , startDate
                                   * , endDate
                                   * }
                                   */
		                              Object_SetPublishSettings: function(callback, args)
		                              {
										  CallService.call(this, callback, "Object/SetPublishSettings", HTTP_METHOD_GET, args, true);
									  },

	                            	/**
                                   * ObjectRelation_Create
                                   *
                                   * @param callback
                                   * @param args {
                                   * , object1GUID
                                   * , object2GUID
                                   * , objectRelationTypeID
                                   * , sequence 
                                   * }
                                   */
		                              ObjectRelation_Create: function (callback, args)
									{
		                              	CallService.call(this, callback, "ObjectRelation/Create", HTTP_METHOD_GET, args, true);
		                              },
		                              
	                            	/**
                                   * ObjectRelation_Delete
                                   *
                                   * @param callback
                                   * @param args {
                                   * , object1GUID
                                   * , object2GUID
                                   * , objectRelationTypeID
                                   * }
                                   */
		                              ObjectRelation_Delete: function (callback, args)
		                              {
		                              	CallService.call(this, callback, "ObjectRelation/Delete", HTTP_METHOD_GET, args, true);
		                              },

                                  /**
                                   * Metadata_Set
                                   *
                                   * @param callback
                                   * @param args {
                                   * , objectGUID
                                   * , metadataSchemaGUID
                                   * , langCode
                                   * , revisionID
                                   * , metadataXML
                                   * }
                                   */
		                              Metadata_Set: function(callback, args)
                                  {
                                      CallService.call(this, callback, "Metadata/Set", HTTP_METHOD_GET, args, true);
                                  },

                                  /**
                                   * StatsObject_Set
                                   *
                                   * @param callback
                                   * @param args {
                                   * , repositoryIdentifier
                                   * , objectIdentifier
                                   * , objectTypeID
                                   * , objectCollectionID
                                   * , channelIdentifier
                                   * , channelTypeID
                                   * , eventTypeID
                                   * , objectTitle
                                   * , IP
                                   * , city
                                   * , country
                                   * , userSessionID
                                   * }
                                   */
		                              StatsObject_Set: function(callback, args)
                                  {
                                      CallService.call(this, callback, "StatsObject/Set", HTTP_METHOD_GET, args, true);
                                  },

                                  /**
                                   * Upload_Initiate
                                   *
                                   * @param callback
                                   * @param args {
                                   * , objectGUID
                                   * , FormatTypeID
                                   * , fileSize
                                   * , supportMultipleChunks
                                   * }
                                   */
		                              Upload_Initiate: function(callback, args)
		                              {
			                                args['supportMultipleChunks'] = typeof args['supportMultipleChunks'] !== 'undefined' ? args['supportMultipleChunks'] : false;
			                                CallService.call(this, callback, "Upload/Initiate", HTTP_METHOD_GET, args, true);
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
	  var _exception = null;
	  var _stacktrace = null;
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
		    _error = data.Results[0].Message;
		    _exception = data.Results[0].Fullname;
		    _stacktrace = data.Results[0].Stacktrace;
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
	  var _exception = null;
	  var _stacktrace = null;

	  if(data.Results.length == 1 &&
       typeof data.Results[0].Fullname != "undefined" &&
       data.Results[0].Fullname.indexOf("Exception") != -1)
	  {
		    _error = data.Results[0].Message;
		    _exception = data.Results[0].Fullname;
		    _stacktrace = data.Results[0].Stacktrace;
	  }
	  else
	  {
		    _results = data.Results;
	  }

	  this.Error = function() { return _error; };
	  this.Exception = function() { return _exception; };
	  this.Stacktrace = function() { return _stacktrace; };
	  this.WasSuccess = function() { return this.Error() == null; };
	  this.Results = function() { return _results; };
	  this.TotalCount = function() { return data.TotalCount; }
	  this.Count = function() { return data.Count; }
}
