using BOS.Api.Models;
using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace BOS.Api.Services
{
    public class FileProcessingService : IFileProcessingService
    {
        // Chemins (Idéalement à mettre dans appsettings.json plus tard, mais ok ici pour l'instant)
        private readonly string brutFolder = @"C:\Users\Utilisateur\OneDrive\Bureau\BOS\Fichier_Brut";
        private readonly string cleanFolder = @"C:\Users\Utilisateur\OneDrive\Bureau\BOS\BOS.Front\public\Fichier_Clean";
        private readonly string logFileFolder = @"C:\Users\Utilisateur\OneDrive\Bureau\BOS\Fichier_Log";
        private readonly string logFile = @"C:\Users\Utilisateur\OneDrive\Bureau\BOS\Fichier_Log\action_log.json";
        private readonly string refFile = @"C:\Users\Utilisateur\OneDrive\Bureau\BOS\Fichier_Ref\Fichier_Ref.csv";

        private Dictionary<string, RoomReference> roomRef;

        public FileProcessingService()
        {
            if (!Directory.Exists(logFileFolder))
                Directory.CreateDirectory(logFileFolder);
        }

        // --- GESTION DES LOGS ---
        private List<string> LastActions
        {
            get
            {
                try
                {
                    if (File.Exists(logFile))
                        return JsonSerializer.Deserialize<List<string>>(File.ReadAllText(logFile)) ?? new List<string>();
                }
                catch { }
                return new List<string>();
            }
            set
            {
                try
                {
                    File.WriteAllText(logFile, JsonSerializer.Serialize(value));
                }
                catch { }
            }
        }

        private void AjouterLog(string s)
        {
            Console.WriteLine("[BACKEND][LOG] " + s);
            var acts = LastActions;
            acts.Insert(0, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} - {s}");
            if (acts.Count > 5) acts = acts.Take(5).ToList();
            LastActions = acts;
        }

        public List<string> GetLogs() => LastActions;

        // --- GESTION DES FICHIERS ---

        public List<string> GetBrutFiles()
        {
            if (!Directory.Exists(brutFolder)) return new List<string>();
            return Directory.GetFiles(brutFolder).Select(Path.GetFileName).ToList();
        }

        public List<string> GetCleanFiles()
        {
            if (!Directory.Exists(cleanFolder)) return new List<string>();
            return Directory.GetFiles(cleanFolder).Select(Path.GetFileName).ToList();
        }

        public async Task UploadBrutFiles(List<IFormFile> files)
        {
            if (!Directory.Exists(brutFolder)) Directory.CreateDirectory(brutFolder);

            foreach (var file in files)
            {
                var filePath = Path.Combine(brutFolder, Path.GetFileName(file.FileName));
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }
                AjouterLog("Importé dans brut : " + file.FileName);
            }
        }

        public bool DeleteBrutFile(string name)
        {
            var filePath = Path.Combine(brutFolder, name);
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
                AjouterLog("Supprimé du brut : " + name);
                return true;
            }
            return false;
        }

        public bool DeleteCleanFile(string name)
        {
            var filePath = Path.Combine(cleanFolder, name);
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
                AjouterLog("Supprimé du clean : " + name);
                return true;
            }
            return false;
        }

        // --- LOGIQUE DE NETTOYAGE ---

        public object ProcessCleaning(bool overwrite)
        {
            if (!Directory.Exists(brutFolder)) Directory.CreateDirectory(brutFolder);
            if (!Directory.Exists(cleanFolder)) Directory.CreateDirectory(cleanFolder);

            var filesBrut = Directory.GetFiles(brutFolder);
            var filesClean = Directory.GetFiles(cleanFolder).Select(Path.GetFileName).ToHashSet(StringComparer.OrdinalIgnoreCase);

            var filesToTransform = new List<(string Source, string Target, string Type)>();
            var created = new List<string>();
            var alreadyExist = new List<string>();

            foreach (var file in filesBrut)
            {
                var name = Path.GetFileName(file);

                // TEMP
                if (name.StartsWith("temperature_", StringComparison.OrdinalIgnoreCase))
                {
                    var match = Regex.Match(name, @"^(temperature_.+?)_([A-Za-z]+)\s(\d{4})\.csv$", RegexOptions.IgnoreCase);
                    if (match.Success)
                    {
                        var baseName = match.Groups[1].Value;
                        var monthAlpha = match.Groups[2].Value;
                        var year = match.Groups[3].Value;
                        var date = DateTime.TryParseExact(monthAlpha + " " + year, "MMMM yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt);
                        string month = date ? dt.Month.ToString("D2") : "??";
                        string yy = date ? dt.ToString("yy") : year.Substring(2, 2);
                        var targetName = $"{baseName}_{month}_{yy}_clean.csv";
                        filesToTransform.Add((file, targetName, "temp"));
                        if (filesClean.Contains(targetName)) alreadyExist.Add(targetName);
                        continue;
                    }
                }

                // WATER
                if (name.StartsWith("water_", StringComparison.OrdinalIgnoreCase))
                {
                    var match = Regex.Match(name, @"^water_([A-Za-z]+)\s(\d{4})\.csv$", RegexOptions.IgnoreCase);
                    if (match.Success)
                    {
                        var monthAlpha = match.Groups[1].Value;
                        var year = match.Groups[2].Value;
                        var date = DateTime.TryParseExact(monthAlpha + " " + year, "MMMM yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt);
                        string month = date ? dt.Month.ToString("D2") : "??";
                        string yy = date ? dt.ToString("yy") : year.Substring(2, 2);
                        var targetName = $"water_{month}_{yy}_clean.csv";
                        filesToTransform.Add((file, targetName, "water"));
                        if (filesClean.Contains(targetName)) alreadyExist.Add(targetName);
                        continue;
                    }
                }

                // ENERGY
                if (name.StartsWith("energy_Power", StringComparison.OrdinalIgnoreCase))
                {
                    var match = Regex.Match(name, @"^(energy_Power.+?)_([A-Za-z]+)\s(\d{4})\.csv$", RegexOptions.IgnoreCase);
                    if (match.Success)
                    {
                        var baseName = match.Groups[1].Value;
                        var monthAlpha = match.Groups[2].Value;
                        var year = match.Groups[3].Value;
                        var date = DateTime.TryParseExact(monthAlpha + " " + year, "MMMM yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt);
                        string month = date ? dt.Month.ToString("D2") : "??";
                        string yy = date ? dt.ToString("yy") : year.Substring(2, 2);
                        var targetName = $"{baseName}_{month}_{yy}_clean.csv";
                        filesToTransform.Add((file, targetName, "energy"));
                        if (filesClean.Contains(targetName)) alreadyExist.Add(targetName);
                        continue;
                    }
                }

                // OCCUPANCY
                if (name.StartsWith("occupancy", StringComparison.OrdinalIgnoreCase))
                {
                    var match = Regex.Match(name, @"^occupancy_([A-Za-z]+)\s(\d{4})\.csv$", RegexOptions.IgnoreCase);
                    if (match.Success)
                    {
                        var monthAlpha = match.Groups[1].Value;
                        var year = match.Groups[2].Value;
                        var date = DateTime.TryParseExact(monthAlpha + " " + year, "MMMM yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt);
                        string month = date ? dt.Month.ToString("D2") : "??";
                        string yy = date ? dt.ToString("yy") : year.Substring(2, 2);
                        var targetName = $"occupancy_{month}_{yy}_clean.csv";
                        filesToTransform.Add((file, targetName, "occupancy"));
                        if (filesClean.Contains(targetName)) alreadyExist.Add(targetName);
                        continue;
                    }
                }
            }

            if (filesToTransform.Count == 0)
            {
                AjouterLog("Aucun fichier à transformer.");
                return new { status = "no-file", message = "Aucun fichier à traiter.", lastActions = LastActions };
            }
            if (alreadyExist.Count > 0 && !overwrite)
            {
                AjouterLog("Collision sur : " + string.Join(", ", alreadyExist));
                return new { status = "already-exist", alreadyExist, message = "Certains fichiers existent déjà dans clean.", lastActions = LastActions };
            }

            ChargerFichierRef();
            foreach (var (src, tgt, type) in filesToTransform)
            {
                var dest = Path.Combine(cleanFolder, tgt);
                try
                {
                    if (type == "temp") NettoyerCsvTemperature(src, dest);
                    else if (type == "water") NettoyerCsvWater(src, dest);
                    else if (type == "energy") NettoyerCsvEnergy(src, dest);
                    else if (type == "occupancy") NettoyerCsvOccupancy(src, dest);
                    created.Add(tgt);
                    AjouterLog($"{(overwrite ? "Écrasé/nettoyé" : "Importé/nettoyé")} : {tgt}");
                }
                catch (Exception ex)
                {
                    AjouterLog($"Erreur sur {tgt} : {ex.Message}");
                }
            }
            if (created.Count > 0)
                AjouterLog("Nettoyage réussi : " + string.Join(", ", created));
            
            return new { status = "ok", created, lastActions = LastActions };
        }

        // --- METHODES PRIVEES DE NETTOYAGE ---

        private void ChargerFichierRef()
        {
            roomRef = new Dictionary<string, RoomReference>();
            if (!File.Exists(refFile)) return;
            using var reader = new StreamReader(refFile);
            var header = reader.ReadLine();
            var cols = header.Split(';');
            int idxName = Array.IndexOf(cols, "Name");
            int idxAliases = 8;
            int idxDesign = 13;

            string line;
            while ((line = reader.ReadLine()) != null)
            {
                var parts = line.Split(';');
                if (parts.Length <= Math.Max(idxName, Math.Max(idxAliases, idxDesign))) continue;
                var room = parts[idxName].Trim();
                var alias = parts[idxAliases].Trim().Replace("\"", "");
                var designation = parts[idxDesign].Trim().Replace("\"", "");
                if (!string.IsNullOrEmpty(room))
                    roomRef[room] = new RoomReference { Alias = alias, Designation = designation };
            }
        }

        private void NettoyerCsvTemperature(string fileIn, string fileOut)
        {
            using var reader = new StreamReader(fileIn);
            using var writer = new StreamWriter(fileOut, false);
            var header = reader.ReadLine();
            var cols = header.Split(",");
            
            int idxTimestamp = Array.IndexOf(cols, "timestamp");
            int idxSensorId = Array.IndexOf(cols, "sensor id");
            int idxTemp = Array.IndexOf(cols, "temperature");
            int idxRoom = Array.IndexOf(cols, "room");
            int idxFloor = Array.IndexOf(cols, "floor");
            int idxZone = Array.IndexOf(cols, "zone");

            writer.WriteLine("timestamp,sensor_uid,temperature,isValidSensor,room,floor,zone,alias,designation");

            string line;
            while ((line = reader.ReadLine()) != null)
            {
                var parts = line.Split(",");
                if (parts.Length < Math.Max(idxZone, idxTemp) + 1) continue;

                string timestamp = parts[idxTimestamp];
                string sensorid = parts[idxSensorId];
                string tempRaw = parts[idxTemp];
                string room = parts[idxRoom];
                string floor = parts[idxFloor];
                string zone = parts[idxZone];

                string sourceId = sensorid;
                var matchUid = Regex.Match(sensorid, @"/OnDijon_Center_01/([A-Za-z0-9]+)_AvgTemperature");
                if (matchUid.Success) sourceId = matchUid.Groups[1].Value;

                string temp = tempRaw.Replace(",", ".");
                bool isValid = double.TryParse(temp, NumberStyles.Any, CultureInfo.InvariantCulture, out var tempVal) && tempVal != 0.0;

                string alias = "";
                string designation = "";
                if (roomRef != null && roomRef.TryGetValue(room, out var refData))
                {
                    alias = refData.Alias;
                    if (alias.Length > 5) alias = "";
                    designation = refData.Designation;
                }

                writer.WriteLine($"{timestamp},{sourceId},{tempRaw},{isValid},{room},{floor},{zone},{alias},{designation}");
            }
        }

        private void NettoyerCsvWater(string fileIn, string fileOut)
        {
            using var reader = new StreamReader(fileIn);
            using var writer = new StreamWriter(fileOut, false);
            var header = reader.ReadLine();
            var cols = header.Split(",");
            int idxTimestamp = Array.IndexOf(cols, "timestamp");
            int idxDisplayName = Array.IndexOf(cols, "display name");
            int idxWater = Array.IndexOf(cols, "water");
            int idxFloor = Array.IndexOf(cols, "floor");

            writer.WriteLine("timestamp,display_name,water,floor");

            var seen = new HashSet<string>();
            string line;
            while ((line = reader.ReadLine()) != null)
            {
                var parts = line.Split(",");
                if (parts.Length < Math.Max(idxFloor, idxWater) + 1) continue;

                var timestampRaw = parts[idxTimestamp];
                var hourKey = timestampRaw.Length >= 13 ? timestampRaw.Substring(0, 13) : timestampRaw;

                var nameRaw = parts[idxDisplayName];
                var display = nameRaw;
                var idxCut = nameRaw.IndexOf(" - Compteur Volume d'Eau");
                if (idxCut >= 0) display = nameRaw.Substring(0, idxCut).Trim();

                var water = parts[idxWater];
                var floorRaw = parts[idxFloor];
                var floor = floorRaw.Split(';')[0].Trim();

                var key = $"{hourKey}|{display}|{water}|{floor}";
                if (!seen.Add(key)) continue;

                writer.WriteLine($"{timestampRaw},{display},{water},{floor}");
            }
        }

        private void NettoyerCsvEnergy(string fileIn, string fileOut)
        {
            using var reader = new StreamReader(fileIn);
            using var writer = new StreamWriter(fileOut, false);
            var header = reader.ReadLine();
            var cols = header.Split(",");
            int idxTimestamp = Array.IndexOf(cols, "timestamp");
            int idxSensorId = Array.IndexOf(cols, "sensor id");
            int idxEnergy = Array.IndexOf(cols, "energy");
            int idxRoom = Array.IndexOf(cols, "room");
            int idxFloor = Array.IndexOf(cols, "floor");
            int idxZone = Array.IndexOf(cols, "zone");

            writer.WriteLine("timestamp,sensor_uid,energy,room,floor,zone,alias,designation");

            var seen = new HashSet<string>();
            string line;
            while ((line = reader.ReadLine()) != null)
            {
                var parts = line.Split(",");
                if (parts.Length < Math.Max(idxZone, idxEnergy) + 1) continue;

                var timestampRaw = parts[idxTimestamp];
                var hourKey = timestampRaw.Length >= 13 ? timestampRaw.Substring(0, 13) : timestampRaw;

                var sensoridRaw = parts[idxSensorId];
                string sensorUid = "";
                int prefix = sensoridRaw.IndexOf("/OnDijon_");
                if (prefix >= 0)
                {
                    var temp = sensoridRaw.Substring(prefix + 9);
                    int underscore = temp.LastIndexOf("_");
                    if (underscore > 0) sensorUid = temp.Substring(0, underscore);
                }

                var energyRaw = parts[idxEnergy];
                string energy = energyRaw.Replace(",", "."); // Correction virgule

                var room = parts[idxRoom];
                var floorRaw = parts[idxFloor];
                var floor = floorRaw.Split(';')[0].Trim();
                var zone = parts[idxZone];

                string alias = "";
                string designation = "";
                if (roomRef != null && roomRef.TryGetValue(room, out var refData))
                {
                    alias = refData.Alias;
                    if (alias.Length > 5) alias = "";
                    designation = refData.Designation;
                }

                var key = $"{hourKey}|{sensorUid}|{room}|{floor}|{zone}";
                if (!seen.Add(key)) continue;

                writer.WriteLine($"{timestampRaw},{sensorUid},{energy},{room},{floor},{zone},{alias},{designation}");
            }
        }

        private void NettoyerCsvOccupancy(string fileIn, string fileOut)
        {
            using var reader = new StreamReader(fileIn);
            using var writer = new StreamWriter(fileOut, false);
            var header = reader.ReadLine();
            var cols = header.Split(",");
            int idxTimestamp = Array.IndexOf(cols, "timestamp");
            int idxSensorId = Array.IndexOf(cols, "sensor id");
            int idxOcc = Array.IndexOf(cols, "occupancy status");
            int idxRoom = Array.IndexOf(cols, "room");
            int idxFloor = Array.IndexOf(cols, "floor");
            int idxZone = Array.IndexOf(cols, "zone");

            writer.WriteLine("timestamp,sensor_uid,occupancy_status,room,floor,zone,alias,designation");

            string line;
            while ((line = reader.ReadLine()) != null)
            {
                var parts = line.Split(",");
                if (parts.Length < Math.Max(idxZone, idxOcc) + 1) continue;

                var timestamp = parts[idxTimestamp];
                string sensoridRaw = parts[idxSensorId];
                string sensorUid = "";
                var occMatch = Regex.Match(sensoridRaw, @"\/OnDijon_[^/]+/([^_]+)_OrPresence");
                if (occMatch.Success) sensorUid = occMatch.Groups[1].Value;

                var occupancy = parts[idxOcc];
                var room = parts[idxRoom];
                var floor = parts[idxFloor];
                var zone = parts[idxZone];

                string alias = "";
                string designation = "";
                if (roomRef != null && roomRef.TryGetValue(room, out var refData))
                {
                    alias = refData.Alias;
                    if (alias.Length > 5) alias = "";
                    designation = refData.Designation;
                }

                writer.WriteLine($"{timestamp},{sensorUid},{occupancy},{room},{floor},{zone},{alias},{designation}");
            }
        }
    }
}