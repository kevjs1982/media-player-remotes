console.debug = function() {};
var roku_images = new Array();
var output = null;
var ssdpData = "";
var ssdpDevices = new Array();
/*
 * This function will be called when this js is loaded.
 */
window.addEventListener("load", function()
	{
		console.log("SSDP multicast app starts");
		output = document.getElementById("output");
 
		$.ajax({
			url: "/images/roku/devices.xml",
			dataType : 'xml',
		}).done(function(data) 
		{
			$(data).find('device').each(function()
			{
				roku = $(this);
				roku_images[roku.attr('prefix')] = "/images/roku/" + roku.attr('image') + ".png";
			})
			console.log(roku_images);
			ssdpStart();
		});
	});


/*
 * translate text string to arryed buffer
 */
function t2ab(str /* String */)
{
    var buffer = new ArrayBuffer(str.length);
    var view = new DataView(buffer);
    for(var i = 0, l = str.length; i < l; i++)
    {
        view.setInt8(i, str.charAt(i).charCodeAt());
    }
    return buffer;
}

/*
 * translate arrayed buffer to text string
 */
function ab2t(buffer /* ArrayBuffer */)
{
    var arr = new Int8Array(buffer);
    var str = "";
    for(var i = 0, l = arr.length; i < l; i++)
    {
        str += String.fromCharCode.call(this, arr[i]);
    }
    return str;
}

/*
 * This function will be called when upd packet is recieved
 */
var recieveData = function(socket, sid)
{
    socket.recvFrom(sid, function(recv)
    {
        var data = ab2t(recv.data);
		data = data.replace(/\r\n/g, "|")

        var dt = new Date();
        var tmp = dt + "<br>";
        tmp += recv.address + ":" + recv.port + "<br>";
        tmp += data.replace("|","<br>");
		tmp +=  + "<br><br><hr>";
		
		var ssdp_info = data.split("|");
		var me = new Array();
		//console.log(ssdp_info);
		for(idx in ssdp_info)
		{
			i = splitWithTail(ssdp_info[idx],":",1);
			//console.log(i);
			me[i[0].trim()] = (i[1] + "").trim()
		}
		
		if(typeof ssdpDevices[me['USN']] === 'undefined' && typeof me['LOCATION'] !== 'undefined') 
		{
			//console.log(me);
			me['friendlyName'] = me['LOCATION'];
			me['modelName'] = "";
			me['modelDescription'] = "";
			me['modelNumber'] = "";
			me['manufacturer'] = "";
			me['serialNumber'] = "";
			me['STy'] = "";
			switch(me['ST'])
			{
				case 'urn:dial-multiscreen-org:device:dial:1':
					me['STy'] = "DIAL";
					break;
				case 'urn:netgem:device:Netbox:1':
					me['STy'] = "Netgem Netbox (EETV)";
					break;
				case 'roku:ecp': 
					me['STy'] = "Roku Streaming Media Player";
					break;
				/*case 'upnp:rootdevice':
					me['STy'] = "Root";			
					break;*/
			}
			ssdpDevices[me['USN']] = me;
			parseDesc(me['USN']);
			redrawSSDPList();
		}

//        tmp += ssdpData;
//        output.innerHTML = tmp;
//        ssdpData = tmp;

        recieveData(socket, sid);
    });
};
function parseDesc(usn)
{
	var url = ssdpDevices[usn]['LOCATION'];
	
	$.ajax({
		  url: url,
		  dataType : 'xml',
		}).done(function(data) {
		  //console.log(data);
		  
		$(data).find('device').each(function()
		{
			var fn = $(this).find('friendlyName').text();
			ssdpDevices[usn]['friendlyName'] = fn.trim();
			ssdpDevices[usn]['manufacturer'] = $(this).find('manufacturer').text().trim();
			ssdpDevices[usn]['modelName'] = $(this).find('modelName').text().trim();
			if (ssdpDevices[usn]['modelName'] == 'Eureka Dongle' && ssdpDevices[usn]['manufacturer'])
			{
				ssdpDevices[usn]['modelName'] = "Chromecast";
			}
			ssdpDevices[usn]['modelDescription'] = $(this).find('modelDescription').text().trim();
			ssdpDevices[usn]['modelNumber'] = $(this).find('modelNumber').text().trim();
			ssdpDevices[usn]['serialNumber'] = $(this).find('serialNumber').text().trim();
			//var Manufacturers = $(this).find('Manufacturer').text();
			//$(this).find('friendlyName').text()
			//$("<li></li>").html(Titles + ", " + Manufacturers).appendTo("#Autom ul");
			//console.log(fn);
			redrawSSDPList();
		}
		);


		});
}
function redrawSSDPList()
{
	var out = "<ul>";
	
	for(idx in ssdpDevices)
	{
		if (ssdpDevices[idx]['STy']!="" )
		{
			image = "";
			if ( ssdpDevices[idx]['ST'] == 'roku:ecp' && typeof(roku_images[ssdpDevices[idx]['serialNumber'].substring(0,2)])!=='undefined')
			{
				
				image = "<img class='rokuimg' src='" + roku_images[ssdpDevices[idx]['serialNumber'].substring(0,2)] + "'>";
			}
			out += "<li>"+image+"<B>" + ssdpDevices[idx]['friendlyName'] + "</b> (" + ssdpDevices[idx]['STy'] + ")<br>";
			out += "<i>" + ssdpDevices[idx]['manufacturer'] + " " +ssdpDevices[idx]['modelName'] + " " + ssdpDevices[idx]['modelNumber'] + "</i><br>"
			out += ssdpDevices[idx]['modelDescription'] + ":" + ssdpDevices[idx]['serialNumber'] + "<br>";
			out += "<a href='" + ssdpDevices[idx]['LOCATION'] + "' target='_blank'>"+ssdpDevices[idx]['LOCATION'] + "</a><br></li>"; 
			//: <a href='" + ssdpDevices[idx]['LOCATION'] + "' target='_blank'>"+ssdpDevices[idx]['friendlyName'] + " <b>" + ssdpDevices[idx]['manufacturer'] + " </b><i>" +ssdpDevices[idx]['modelName'] + "</i></a></li>"
		}
	}
	out += "</ul>";
	output.innerHTML = out;
}

/*
 * This function will be called when "SSDP Start" button is pushed.
 */
var ssdpStart = function()
{
	//console.log("Scan");
    // M-Search packed w/ "ssdp:all"
    var MSearchAll = "M-SEARCH * HTTP/1.1\r\n" +
        "ST: ssdp:all\r\n" +
        "MAN: \"ssdp:discover\"\r\n" +
        "HOST: 239.255.255.250:1900\r\n" +
        "MX: 10\r\n\r\n";
    // chrome socket
    var socket = chrome.socket || chrome.experimental.socket;
    // SSDP multicast address
    var SSDPMulticastAddress = "239.255.255.250";
    // SSDP multicast port
    var SSDPMulticastPort = 1900;
    // socket id
    var sid;

    // create udp socket
    socket.create('udp', {}, function(socketInfo)
    {
        sid = socketInfo.socketId;
        //console.log("socket id: " + sid);
        socket.bind(sid, "0.0.0.0", 0, function(res)
        {
            if(res !== 0) {
                throw('cannot bind socket');
                return -1;
            }

            // recieve data
            recieveData(socket, sid);

            // Send SSDP Search x 2
            var buffer = t2ab(MSearchAll);
            for(var i = 0; i < 4; i++)
            {
                socket.sendTo(sid, buffer, SSDPMulticastAddress, SSDPMulticastPort, function(e)
                {
                    if(e.bytesWritten < 0) {
                        throw("an Error occured while sending M-SEARCH : "+e.bytesWritten);
                    }
                });
            }
        });
    });
	
	setTimeout(ssdpStart,10000);
};
 
 
function splitWithTail(str,delim,count){
  var parts = str.split(delim);
  var tail = parts.slice(count).join(delim);
  var result = parts.slice(0,count);
  result.push(tail);
  return result;
}