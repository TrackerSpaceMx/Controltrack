import httpx
import json
import crud_tenants
from datetime import datetime, timezone, timedelta
import traceback


class UnitsMonitoring():
    def __init__(self):
        pass

    @staticmethod
    async def organize_events_all_response(response):
        units_response=[]
        units_list = response.get("data")
        gmt6 = timezone(timedelta(hours=-6))
        for unit in units_list:            
            last_signal_at = unit["ras_ras_data_ult_comunicacao"]
            dt = datetime.strptime(last_signal_at, "%d/%m/%Y %H:%M:%S")
            dt = dt.replace(tzinfo=timezone.utc)
            dt = dt.astimezone(gmt6)
            last_signal_at_local = dt.strftime("%d/%m/%Y %H:%M:%S")

            minutes_difference = await UnitsMonitoring.minutes_without_signal(last_signal_at_local)
            unit_information ={
                "plate": unit["ras_vei_placa"],
                "imei": unit["ras_ras_id_aparelho"],
                "vehicle_name" : unit["ras_vei_veiculo"],
                "last_signal_at": last_signal_at_local,
                "minutes_ago": minutes_difference
            }
            units_response.append(unit_information)
        return units_response
    
    @staticmethod
    async def merge_units(api_units,db_units):
        imeis_already_in_database = {i["imei"] for i in db_units}
        units_filtered = []
        active_imeis = set(device["imei"] for device in db_units if device["active"])
        in_maintenance_devices = set(device["imei"] for device in db_units if device["in_maintenance"])
        for unit in api_units:
            imei = unit.get("imei")
            if imei in imeis_already_in_database and imei in active_imeis:
                unit.update({"in_database":True})
            else:
                unit.update({"in_database":False})
            
            if imei in in_maintenance_devices:
                unit.update({"in_maintenance":True})
            else:
                unit.update({"in_maintenance":False})

            units_filtered.append(unit)
        
        return units_filtered
    
    @staticmethod
    async def minutes_without_signal(last_signal: str) -> int:
        gmt6 = timezone(timedelta(hours=-6))
        
        last = datetime.strptime(last_signal, "%d/%m/%Y %H:%M:%S")
        last = last.replace(tzinfo=gmt6) 
        now = datetime.now(timezone.utc).astimezone(gmt6)
        diff = now - last
        return int(diff.total_seconds() / 60)
    

    @staticmethod
    async def convert_unit_to_minutes(value,unit):
        value_in_minutes=0
        if unit == "minutes":
            value_in_minutes= int(value)
        
        elif unit =="hours":
            value_in_minutes = int(value) *60
        
        elif unit  =="days":
            value_in_minutes  =(int(value)*24)*60

        return value_in_minutes


    async def show_units_available(self,db,tenant_id,url):
        try:
            units_from_api = await self.get_units_from_fulltrack(url)
            units_from_database = await crud_tenants.select_monitored_devices(db,tenant_id)


            if not units_from_database:
                for unit in units_from_api:
                    unit.update({"in_database":False})
                return units_from_api
            
            
            
            merge_units_result = await UnitsMonitoring.merge_units(units_from_api,units_from_database)
            return merge_units_result

        except Exception as err:
            print("Error getting the available units: ",err)
            traceback.print_exc()
            return False
    

    async def get_units_from_fulltrack(self,url):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                try:

                    r_events   = await client.get(url)
                    
                    if r_events.status_code ==200:
                        data = r_events.json()
                        if len(data) < 0:
                            return False
                        organized_information =await UnitsMonitoring.organize_events_all_response(data)
                        return organized_information
                    else:
                        return []
                except httpx.RequestError as e:
                    print("Error querying fulltrack api: ",e)
                    return []

        except Exception as err:
            print("Error getting the available units: ",err)
            return []
    

    async def register_alert_configuration(self,db,tenant_id,body):
        try:

            alert_configuration_response = await crud_tenants.create_alert_configuration(db,tenant_id,body)
            if not alert_configuration_response:
                return False
            
            devices = body.get("devices")

            monitored_devices_response = await crud_tenants.insert_monitored_devices(db,tenant_id,devices)

            return monitored_devices_response


        except Exception as err:
            print("Error registering alert configuration: ",err)
            return False
    

    async def get_units_status(self,db,tenant_id,url):
        try:
            units_information = await self.get_units_from_fulltrack(url)
            alert_configuration = await crud_tenants.get_alert_configuration(db,tenant_id)
            monitored_devices = await crud_tenants.select_monitored_devices(db,tenant_id)


            if not units_information:
                return False
            if not alert_configuration or not monitored_devices:
                for unit in units_information:
                    unit.update({"signal_status":"no_monitoring"})
                return units_information

            warning_time_value = alert_configuration["warning_time_value"]
            warning_time_unit = alert_configuration["warning_time_unit"]
            alert_time_value = alert_configuration["alert_time_value"]
            alert_time_unit = alert_configuration["alert_time_unit"]
            units_merged = await UnitsMonitoring.merge_units(units_information,monitored_devices)

            active_imeis = set(device["imei"] for device in monitored_devices if device["active"])
            
            for unit in units_merged:
                database_status= unit.get("in_database")
                in_maintenance = unit.get("in_maintenance")
                imei = unit.get("imei")
                plate = unit.get("plate")
                vehicle_name = unit.get("vehicle_name")
                
                if database_status and imei in active_imeis:
                    minutes_ago = unit.get("minutes_ago")
                    unit_information =[{"imei":imei,"plate":plate,"vehicle_name":vehicle_name,"active":1,"in_maintenance":0} ]
                    signal_status = await self.validate_unit_status(warning_time_value,warning_time_unit,alert_time_value,alert_time_unit,minutes_ago,in_maintenance,tenant_id,unit_information,db)
                    unit.update({"signal_status":signal_status})
                    
                else:
                    unit.update({"signal_status":"no_monitoring"})



            return units_information

        except Exception as err:
            print("Error getting the monitored units status: ",err)
            return False
    

    async def validate_unit_status(self,warning_time_value,warning_time_unit,alert_time_value,alert_time_unit,minutes_ago,in_maintenance,tenant_id,unit_information,db):    
        warning_time_minutes = await UnitsMonitoring.convert_unit_to_minutes(warning_time_value,warning_time_unit)
        alert_time_minutes = await UnitsMonitoring.convert_unit_to_minutes(alert_time_value,alert_time_unit)

        signal_status = ""
        if in_maintenance:
            signal_status = "in_maintenance"
            if minutes_ago < warning_time_minutes:
                signal_status = "online"
                maintentance_status_update = await crud_tenants.insert_monitored_devices(db,tenant_id,unit_information)
            elif minutes_ago < warning_time_minutes:
                signal_status = "warning"
                maintentance_status_update = await crud_tenants.insert_monitored_devices(db,tenant_id,unit_information)
            return signal_status
        
        if minutes_ago > warning_time_minutes and minutes_ago < alert_time_minutes:
            signal_status ="warning"
        
        elif minutes_ago > alert_time_minutes:
            signal_status = "no_signal"
        
        else:
            signal_status = "online"
        
        return signal_status




    

