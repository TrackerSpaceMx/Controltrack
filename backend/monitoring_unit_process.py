import httpx
import json
import crud_tenants
from datetime import datetime


class UnitsMonitoring():
    def __init__(self):
        pass

    @staticmethod
    async def organize_events_all_response(response):
        units_response=[]
        units_list = response.get("data")
        for unit in units_list:
            last_signal_at = unit["ras_ras_data_ult_comunicacao"]
            minutes_difference = await UnitsMonitoring.minutes_without_signal(last_signal_at)
            unit_information ={
                "plate": unit["ras_vei_placa"],
                "imei": unit["ras_ras_id_aparelho"],
                "vehicle_name" : unit["ras_vei_veiculo"],
                "last_signal_at": last_signal_at,
                "minutes_ago": minutes_difference
            }
            units_response.append(unit_information)
        return units_response
    
    @staticmethod
    async def merge_units(api_units,db_units):
        imeis_already_in_database = {i["imei"] for i in db_units}
        units_filtered = []
        for unit in api_units:
            imei = unit.get("imei")
            if imei in imeis_already_in_database:
                unit.update({"in_database":True})
            else:
                unit.update({"in_database":False})
            units_filtered.append(unit)
        
        return units_filtered
    
    @staticmethod
    async def minutes_without_signal(last_signal: str) -> int:
        last = datetime.strptime(last_signal, "%d/%m/%Y %H:%M:%S")
        now = datetime.utcnow()
        diff = now - last
        return int(diff.total_seconds() / 60)


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
            for device in devices:
                device.update({"active:":1})
            
            monitored_devices_response = await crud_tenants.insert_monitored_devices(db,tenant_id,devices)

            return monitored_devices_response


        except Exception as err:
            print("Error registering alert configuration: ",err)
            return False
    

    async def get_units_status(self,db,tenant_id,url):
        try:
            print("URL: ",url)
            units_information = await self.get_units_from_fulltrack(url)
            alert_configuration = await crud_tenants.get_alert_configuration(db,tenant_id)
            monitored_devices = await crud_tenants.select_monitored_devices(db,tenant_id)

            if not units_information:
                return False
            
            if not alert_configuration:
                print("without configuration")
  
            
            print("RESPOINSE: ",units_information)


        except Exception as err:
            print("Error getting the monitored units status: ",err)