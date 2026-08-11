;var L = 0
var m1 = "Click here to sort on "
var m2 = "यहाँ क्लिक करें "
var m3 = " द्वारा क्रम से देखने के लिए"
var m4 = "Click here to filter "
var m5 = " trains"
var m6 = " को चलने वाली ट्रेन"
var m7 = " श्रेणी द्वारा ट्रेन क्रम से देखने के लिए"

var m_names = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
var m_namesL = new Array("जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितम्बर", "अक्टूबर", "नवम्बर", "दिसम्बर")
var m_namesL2 = new Array("जन", "फ़र", "मार्च", "अप्रै", "मई", "जून", "जुला", "अग", "सित", "अक्टू", "नव", "दिस")
var d_names = new Array("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
var d_namesL = new Array("रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार")
var d_namesh = new Array("Su", "Mo", "Tu", "We", "Th", "Fr", "Sa")
var d_nameshL = new Array("रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि")
var d_names2 = new Array("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
var d_names3 = new Array("M", "Tu", "W", "Th", "F", "Sa", "Su")
var d_names4 = new Array("M", "T", "W", "T", "F", "S", "S")
var d_names2L = new Array("सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार")
var d_names2S = new Array("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
var d_names2SL = new Array("सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "रवि")
var n_Classes = new Array("", "1A", "2A", "3A", "CC", "FC", "SL", "2S", "3E", "GN", "EA", "EC", "EV", "VC", "VS")
var n_Classes2 = new Array("1A", "2A", "3A", "CC", "FC", "SL", "2S", "3E", "GN", "EA", "EC", "EV", "VC", "VS")
var n_ClassesName = new Array("", "First AC", "2 Tier AC", "3 Tier AC", "Chair Car", "First Class", "Sleeper", "2nd Sitting", "3 Tier Economy", "General", "Executive", "Executive", "Vistadome AC", "Vistadome Chair Car","Vistadome Non AC")
var n_ClassesName2 = new Array("First AC", "2 Tier AC", "3 Tier AC", "Chair Car", "First Class", "Sleeper", "2nd Sitting", "3 Tier Economy", "General", "Executive", "Executive", "Vistadome AC", "Vistadome Chair Car", "Vistadome Non AC")

function IRBlockMessage(Type)
{
    var s = "<br/><div style='font-size:2em;text-align:center'>"
    
    var Mess = "to view ";

    switch(Type)
    {
        case "CA": Mess += "Current Availability"; break;
        case "AVL_0":Mess+="Availability";break;
        case "RUN":Mess+="Running Status of train";break;
        case "PNR":Mess+="PNR Status";break;
        case "FARE":Mess+="Fare amount";break;
        default :
            Mess="";    
    }

    if(Mess!="")
        Mess+=" from Indianrailway website";

    //console.log("PluginVersion-" +PluginVersion);

        s += "<br/>Its easy & fast, " + Mess;
        
        if (BrowserName == "Chrome")
        {
            //s += "<br/><br/><a style='color:blue' href='#' onclick='chrome.webstore.install();return false;'>Click here to install latest plugin</a> ";
            s += "<br/><br/><a style='color:blue' href='https://chrome.google.com/webstore/detail/erailin/aopfgjfeiimeioiajeknfidlljpoebgc' target='_balnk' >Click here to install latest plugin</a> ";
            s += "<br/><br/>After install, please reload the page.";
        }
        //else if(BrowserName == "Firefox")
        //{
        //    s += "<br/><br/><a style='color:blue' target='_blank' href='https://addons.mozilla.org/en-US/firefox/addon/erail-plugin-for-firefox/'>Click here to install plugin</a>";
        //    s += "<br/><br/><a href='/rail/help/FirefoxHowtoInstall.pdf'>How to install</a>";
        //}
        else
        {
            s += "<br/><br/>Please install <a style='color:blue' href='https://www.google.com/chrome/?hl=en&brand=chmo'>Chrome</a>";
        }

    
    return s+"</div>";
}

function SeatHelpInfo()
{
    var a = "<tr><td class='";
    return "<table style='text-indent:3px;width:auto'>" +

        
    //"<tr><td>Get<td>Click to view seats" +
        a + "G'>00<td>Seats Booking Available" +
        a + "GC'><a>00</a><td>Seats Available After Charting" +
    a + "Y'>00<td title='Reservation Against Cancellation'><a href='/info/pnr-status-rac/103' target='_blank'>RAC</a>" +
    a + "WL'>00<td ><a title='General Waiting List' href='/info/pnr-status-gnwl-general/105' target='_blank'>GNWL</a>" +
    " / <a title='Remote Location Waiting List' href='/info/pnr-status-rlwl-remote-location/109' target='_blank'>RLWL</a>" +
    " / <a title='Pooled Quota Waiting List'href='/info/pnr-status-pqwl-pooled-quota/108' target='_blank'>PQWL</a>" +
    //a+"Error'>NA<td>Not Available" +
    //a+"Error'>TD<td>Train Departed" +
    a + "Error'>CD<td><a href='/info/pnr-status-charting/107' target='_blank'>Charting Done</a>" 
    //a+"Error'>ER<td>Error" 
    +"</table>";
}

var T = [
"<b>Main Stations</b>", //0
"Main Stations", //1
"<b>All Stations</b>", //2
"All Stations", //3
"Train", //4
"Train Name", //5
"From", //6
"To", //7
"Dep.", //8
"Arr.", //9
"Travel", //10
m1 + "Train Number", //11
m1 + "Train Name", //12
"Departure in next 24 hours", //13
m1 + "From Station", //14
m1 + "Departure time at the From station", //15
m1 + "To Station", //16
m1 + "Arrival Time at the To Station", //17
m1 + "Travel Time of the train", //18
m1 + "daily trains" + m5, //19
m4 + "Monday" + m5, //20
m4 + "Tuesday" + m5, //21
m4 + "Wednesday" + m5, //22
m4 + "Thursday" + m5, //23
m4 + "Friday" + m5, //24
m4 + "Saturday" + m5, //25
m4 + "Sunday" + m5, //26
m4 + "AC 1-tier sleeper" + m5, //27
m4 + "AC 2-tier sleeper" + m5, //28
m4 + "AC 3-tier sleeper" + m5, //29
m4 + "AC Chair Car" + m5, //30
m4 + "First Class" + m5, //31
m4 + "Sleeper Class" + m5, //32
m4 + "Second Sitting" + m5, //33
m4 + "3 AC Economy" + m5, //34
"Food available on train", //35
'Serial Number', //36
'Code', //37
'Stn Name', //38
'Arr.', //39
'Dep.', //40
'Halt', //41
'PF', //42
'Dist.', //43
'Day', //44
'Remark', //45
'Station Code', //46
'Station Name', //47
'Arrival Time', //48
'Departure Time', //49
'Halt Time ( in minutes )', //50
"Select Return date for availability", //51
"Please Wait, getting trains list ...", //52
"Live ", //53
"View availability of ", //54
"Filter", //55
"Print", //56
"Share Link", //57
"Print search list", //58
"Travel agents contact for your listing / ट्रैवेल एजेंट अपनी लिस्टिंग के लिए संपर्क करें ", //59
" travel agents details coming soon", //60
"Advertise", //61
"Tablet URL", //62
"Use Get Fare for base fare & check <a href='https://www.irctc.co.in' target='_blank'>IRCTC</a> for current fare", //63
"Trains between ", //64
"", //65
" and ", //66
"Select Departure date for availability", //67
" ( Train Ends At This Station )", //68
" (First Station)", //69
"Click on train number to View fare and schedule", //70
" days", //71
"Distance - ", //72
"Average Speed - ", //73 
" km/hr", //74
"Nxt24", //75
" on ", //76
"search  ", //77
"  trains", //78
"Select tatkal stations combination, if above Quota selection is Tatkal", //79
" Adult", //80
" Child", //81
" Senior Male", //82
" Senior Female", //83
"No direct trains found, Please use a Via station for your search", //84
"View one of shortest route", //85
"Suggestion Shown On The Right Side - Search History", //86
"5 to 11 years", //87
"Male 60 years and Above", //88
"Female 58 years and Above", //89
"", //90
"View Running Days", //91
" - View arrival & departure of trains", //92
" to ", //93
"Highlighted days show run days of the selected train", //94
"Close Calendar", //95
"Advance Reservation Period=", //96
"Click to get live running status", //97
"", //98
"Dynamic", //99
"Departure Day", //100
"Arrival Day", //101
"Class", //102
"Zone", //103
"Div.", //104
"Departure Station", //105
"Arrival Station", //106
"Type", //107
"Get Trains", //108
"Return Trains", //109
"Use this link to send to your friends for direct search of trains", //110
"Clear Filters", //111
"Please enter 10 digit PNR number", //112
"Print", //113
"After Search of train", //114
" from ", //115
" on ", //116
"Click here to get current status of PNR", //117
"Get PNR Status", //118
"Type PNR No", //119
"Show Train Detail", //120
"Get the Full Train Route", //121
"Train not found", //122
"For All type of Concessions Fare<br/>&nbsp;Click on Train Number and then <br/>&nbsp;Click on Fare of Class", //123
"", //124
"Via Station", //125
"Please select a Via station", //126
"From and Via Station cannot be same", //127
"Via and To Station cannot be same", //128
"From and To Station cannot be same", //129
"Fare",  //130
"Click here to apply advance filters to the search list", //131
"After", //132 
"Click on a Via station to view trains", //133
"Total", //134
"Total Journey Time", //135
"T.Fare", //136
"Please select a train from the list to check the running status.", //137
"Click here to view tatkal opening date", //138
"Click here to view train list", //139
"Tatkal Dates", //140
"Train List", //141
"Platform", //142
", Click to change station", //143
"Click to view concession fare for -", //144
"Remove Via", //145
"Travel Date", //146S
"Any", //147
"Booking Opens On", //148
"General", //149
"Coach composition is historic data and does not represent current status.", //150
"Availability Chart", //151
"Current Seats", //152
"Train runs for limited period", //153
"Additional Information", //154
"Shortest Route", //155
"For support please whatsapp on <a href='https://wa.me/917454858306' target='_blank'>7454858306</a>", //156
"Note:There is no Ticket booking in eRail.in.",//157
"View trains running on select date",//158
"Tatkal", //159
"Please disable Ads Blocker",//160
" km", //161
"Get Live",  //162
"Live Status at ",  //163
"",  //164
"View availability of seats from First station to Last station of the train",//165
"Sort on Date",//166
"First / Last Stn Seats",//167
"Train Number",//168
"S.No.",//169
"DATE(DD-MM-YYYY)",//170
"CLASS-1A",//171
"CLASS-2A",//172
"CLASS-3A",//173
"CLASS-CC",//174
"CLASS-FC",//175
"CLASS-SL",//176
"CLASS-2S",//177
"CLASS-3E",//178
"Date",//179
"Departed",//180
"Be your own boss, become Official <b>IRCTC Agent</b> अपने बॉस खुद बनें, आज आधिकारिक <b>IRCTC</b> एजेंट बनें."//181
];