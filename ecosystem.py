class Ecosystem:
    def __init__(self, name, climate_type):
        self.name = name
        self.climate_type = climate_type
        self.organisms = []
        self.temperature = 0
        self.humidity = 0
    
    def add_organism(self, organism):
        self.organisms.append(organism)
    
    def remove_organism(self, organism):
        if organism in self.organisms:
            self.organisms.remove(organism)
    
    def set_conditions(self, temperature, humidity):
        self.temperature = temperature
        self.humidity = humidity
    
    def get_ecosystem_info(self):
        return {
            "name": self.name,
            "climate": self.climate_type,
            "organisms": len(self.organisms),
            "temperature": self.temperature,
            "humidity": self.humidity
        }

# Example usage
forest = Ecosystem("Temperate Forest", "Temperate")
forest.add_organism("Oak Tree")
forest.add_organism("Deer")
forest.add_organism("Wolf")
forest.set_conditions(18, 65)

print(forest.get_ecosystem_info())