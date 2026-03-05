from pony.orm import db_session, select, flush
from fastapi import HTTPException
from src.models import MetodoPagoConfigurable, SubmetodoPago, Sucursal, Usuario
from datetime import datetime
from typing import List, Dict, Optional

class MetodosPagoServices:
    
    def __init__(self):
        pass
    
    def crear_metodos_por_defecto(self, sucursal_id: int) -> bool:
        """Crea métodos de pago por defecto para una sucursal si no existen.
        IMPORTANTE: Este método debe ser llamado desde dentro de una sesión @db_session activa."""
        sucursal = Sucursal.get(id=sucursal_id)
        if not sucursal:
            raise HTTPException(status_code=404, detail="Sucursal no encontrada")
        
        # Verificar si ya tiene métodos - verificar específicamente si existe "Efectivo" como método por defecto
        # Obtener todos los métodos y filtrar completamente en Python para evitar problemas con TO_BOOL
        sucursal_id_local = sucursal_id
        try:
            # Obtener todos los métodos sin usar lambda (más seguro)
            todos_metodos = list(MetodoPagoConfigurable.select())
            # Filtrar en Python para encontrar "Efectivo" de la sucursal
            efectivo_existente = None
            for m in todos_metodos:
                try:
                    # Verificar que pertenezca a la sucursal y sea "Efectivo"
                    if hasattr(m, 'sucursal') and m.sucursal and m.sucursal.id == sucursal_id_local:
                        if hasattr(m, 'nombre') and m.nombre == "Efectivo":
                            efectivo_existente = m
                            break
                except Exception as e:
                    print(f"⚠️ Error al verificar método ID {getattr(m, 'id', 'unknown')}: {e}")
                    continue
            
            if efectivo_existente:
                # Ya tiene métodos por defecto, no crear nuevos
                return False
        except Exception as e:
            print(f"⚠️ Error al verificar métodos existentes: {e}")
            # Si hay error crítico, asumir que no existen métodos para evitar duplicados
            return False
        
        # Crear métodos por defecto
        # 1. Efectivo
        efectivo = MetodoPagoConfigurable(
            sucursal=sucursal,
            nombre="Efectivo",
            activo=True,
            tiene_submetodos=False,
            orden=1
        )
        flush()
        
        # 2. Tarjeta
        tarjeta = MetodoPagoConfigurable(
            sucursal=sucursal,
            nombre="Tarjeta",
            activo=True,
            tiene_submetodos=True,
            orden=2
        )
        flush()
        
        SubmetodoPago(metodo_pago=tarjeta, nombre="Visa", activo=True, orden=1)
        SubmetodoPago(metodo_pago=tarjeta, nombre="Master", activo=True, orden=2)
        flush()
        
        # 3. Billetera Virtual
        billetera = MetodoPagoConfigurable(
            sucursal=sucursal,
            nombre="Billetera Virtual",
            activo=True,
            tiene_submetodos=True,
            orden=3
        )
        flush()
        
        SubmetodoPago(metodo_pago=billetera, nombre="Mercado Pago", activo=True, orden=1)
        SubmetodoPago(metodo_pago=billetera, nombre="Naranja X", activo=True, orden=2)
        flush()
        
        # 4. Transferencia
        MetodoPagoConfigurable(
            sucursal=sucursal,
            nombre="Transferencia",
            activo=True,
            tiene_submetodos=False,
            orden=4
        )
        flush()
        
        return True
    
    @db_session
    def get_metodos_por_sucursal(self, sucursal_id: int, usuario_id: Optional[int] = None, solo_activos: bool = False) -> List[Dict]:
        """Obtiene los métodos de pago configurables de una sucursal.
        
        Args:
            sucursal_id: ID de la sucursal
            usuario_id: ID del usuario (opcional)
            solo_activos: Si es True, solo devuelve métodos activos. Si es False (default), devuelve todos.
        """
        sucursal = Sucursal.get(id=sucursal_id)
        if not sucursal:
            raise HTTPException(status_code=404, detail="Sucursal no encontrada")
        
        # Validar permisos si hay usuario
        if usuario_id:
            usuario = Usuario.get(id=usuario_id)
            if not usuario:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
            # Los empleados solo pueden ver métodos de su sucursal
            from src.models import Roles
            if usuario.rol == Roles.EMPLEADO and usuario.sucursal.id != sucursal_id:
                raise HTTPException(status_code=403, detail="No puedes ver métodos de pago de otra sucursal")
        
        # Asegurar que existan métodos por defecto
        self.crear_metodos_por_defecto(sucursal_id)
        
        # Obtener métodos ordenados (activos o todos según el parámetro)
        # Usar método robusto: obtener todos y filtrar en Python para evitar problemas con Pony ORM
        sucursal_id_local = sucursal_id
        
        # Obtener todos los métodos y filtrar en Python (método más robusto)
        print(f"🔍 Obteniendo todos los métodos de la BD...")
        todos_metodos = list(MetodoPagoConfigurable.select())
        print(f"🔍 Total de métodos en BD: {len(todos_metodos)}")
        
        metodos = []
        for m in todos_metodos:
            try:
                # Acceder a las propiedades de forma segura
                m_sucursal_id = getattr(m, 'sucursal', None)
                if m_sucursal_id:
                    m_sucursal_id = m_sucursal_id.id if hasattr(m_sucursal_id, 'id') else None
                
                if m_sucursal_id == sucursal_id_local:
                    # Verificar filtro de activo si es necesario
                    if solo_activos:
                        m_activo = getattr(m, 'activo', False)
                        if not m_activo:
                            continue
                    metodos.append(m)
                    print(f"  ✅ Método encontrado: ID={m.id}, nombre={getattr(m, 'nombre', 'N/A')}, sucursal_id={m_sucursal_id}")
            except Exception as e2:
                print(f"⚠️ Error al procesar método ID {getattr(m, 'id', 'unknown')}: {e2}")
                continue
        
        # Ordenar por orden
        metodos.sort(key=lambda m: m.orden or 0)
        
        print(f"🔍 Métodos encontrados para sucursal {sucursal_id_local} (solo_activos={solo_activos}): {len(metodos)}")
        for m in metodos:
            print(f"  - Método ID {m.id}: {m.nombre} (activo={m.activo})")
        
        result = []
        for metodo in metodos:
            submétodos = []
            if metodo.tiene_submetodos:
                # Usar variable local para evitar problemas con Pony ORM
                metodo_id_local = metodo.id
                # Obtener todos los submétodos y filtrar en Python (método más robusto)
                print(f"🔍 Obteniendo submétodos para método ID {metodo_id_local}...")
                todos_submetodos = list(SubmetodoPago.select())
                print(f"🔍 Total de submétodos en BD: {len(todos_submetodos)}")
                
                submetodos_list = []
                for s in todos_submetodos:
                    try:
                        # Acceder a las propiedades de forma segura
                        s_metodo_pago_id = getattr(s, 'metodo_pago', None)
                        if s_metodo_pago_id:
                            s_metodo_pago_id = s_metodo_pago_id.id if hasattr(s_metodo_pago_id, 'id') else None
                        
                        if s_metodo_pago_id == metodo_id_local:
                            # Verificar filtro de activo si es necesario
                            if solo_activos:
                                s_activo = getattr(s, 'activo', False)
                                if not s_activo:
                                    continue
                            submetodos_list.append(s)
                            print(f"  ✅ Submétodo encontrado: ID={s.id}, nombre={getattr(s, 'nombre', 'N/A')}, metodo_pago_id={s_metodo_pago_id}")
                    except Exception as e3:
                        print(f"⚠️ Error al procesar submétodo ID {getattr(s, 'id', 'unknown')}: {e3}")
                        continue
                
                submetodos_list.sort(key=lambda s: getattr(s, 'orden', 0) or 0)
                    
                submétodos = [
                    {
                        "id": s.id,
                        "nombre": s.nombre,
                        "activo": s.activo,
                        "orden": s.orden
                    }
                    for s in submetodos_list
                ]
            
            result.append({
                "id": metodo.id,
                "nombre": metodo.nombre,
                "activo": metodo.activo,
                "tiene_submetodos": metodo.tiene_submetodos,
                "orden": metodo.orden,
                "submétodos": submétodos
            })
        
        print(f"✅ Resultado final: {len(result)} métodos devueltos")
        for r in result:
            print(f"  - {r['nombre']} (ID: {r['id']}, activo: {r['activo']})")
        
        return result
    
    @db_session
    def crear_metodo_pago(self, metodo_data: dict, usuario_id: int) -> MetodoPagoConfigurable:
        """Crea un nuevo método de pago (solo ADMIN)"""
        usuario = Usuario.get(id=usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        from src.models import Roles
        if usuario.rol != Roles.ADMIN:
            raise HTTPException(status_code=403, detail="Solo los administradores pueden crear métodos de pago")
        
        sucursal_id = metodo_data["sucursal_id"]
        nombre_metodo = metodo_data["nombre"]
        
        sucursal = Sucursal.get(id=sucursal_id)
        if not sucursal:
            raise HTTPException(status_code=404, detail="Sucursal no encontrada")
        
        # Verificar que no exista un método con el mismo nombre en la sucursal
        # Usar select en lugar de get para evitar problemas con and en lambda
        existentes = MetodoPagoConfigurable.select(
            lambda m: m.sucursal.id == sucursal_id
        )
        existente = None
        for m in existentes:
            if m.nombre == nombre_metodo:
                existente = m
                break
        
        if existente:
            raise HTTPException(status_code=400, detail=f"Ya existe un método de pago con el nombre '{nombre_metodo}' en esta sucursal")
        
        metodo = MetodoPagoConfigurable(
            sucursal=sucursal,
            nombre=metodo_data["nombre"],
            activo=metodo_data.get("activo", True),
            tiene_submetodos=metodo_data.get("tiene_submetodos", False),
            orden=metodo_data.get("orden", 0)
        )
        flush()
        
        return metodo
    
    @db_session
    def actualizar_metodo_pago(self, metodo_id: int, metodo_data: dict, usuario_id: int) -> MetodoPagoConfigurable:
        """Actualiza un método de pago (solo ADMIN)"""
        from src.models import Roles
        usuario = Usuario.get(id=usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        if usuario.rol != Roles.ADMIN:
            raise HTTPException(status_code=403, detail="Solo los administradores pueden actualizar métodos de pago")
        
        metodo = MetodoPagoConfigurable.get(id=metodo_id)
        if not metodo:
            raise HTTPException(status_code=404, detail="Método de pago no encontrado")
        
        # Verificar que el nombre no esté duplicado si se cambia
        if "nombre" in metodo_data and metodo_data["nombre"] != metodo.nombre:
            nuevo_nombre = metodo_data["nombre"]
            sucursal_id_check = metodo.sucursal.id
            # Usar select y filtrar en Python para evitar problemas con and en lambda
            existentes = MetodoPagoConfigurable.select(
                lambda m: m.sucursal.id == sucursal_id_check
            )
            existente = None
            for m in existentes:
                if m.nombre == nuevo_nombre and m.id != metodo_id:
                    existente = m
                    break
            if existente:
                raise HTTPException(status_code=400, detail=f"Ya existe un método de pago con el nombre '{metodo_data['nombre']}' en esta sucursal")
        
        if "nombre" in metodo_data:
            metodo.nombre = metodo_data["nombre"]
        if "activo" in metodo_data:
            metodo.activo = metodo_data["activo"]
        if "tiene_submetodos" in metodo_data:
            metodo.tiene_submetodos = metodo_data["tiene_submetodos"]
        if "orden" in metodo_data:
            metodo.orden = metodo_data["orden"]
        
        flush()
        
        return metodo
    
    @db_session
    def crear_submetodo(self, submetodo_data: dict, usuario_id: int) -> SubmetodoPago:
        """Crea un nuevo submétodo de pago (solo ADMIN)"""
        usuario = Usuario.get(id=usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        from src.models import Roles
        if usuario.rol != Roles.ADMIN:
            raise HTTPException(status_code=403, detail="Solo los administradores pueden crear submétodos de pago")
        
        metodo = MetodoPagoConfigurable.get(id=submetodo_data["metodo_pago_id"])
        if not metodo:
            raise HTTPException(status_code=404, detail="Método de pago no encontrado")
        
        if not metodo.tiene_submetodos:
            raise HTTPException(status_code=400, detail="Este método de pago no acepta submétodos")
        
        # Verificar que no exista un submétodo con el mismo nombre
        metodo_pago_id_check = submetodo_data["metodo_pago_id"]
        nombre_submetodo = submetodo_data["nombre"]
        # Usar select y filtrar en Python para evitar problemas con and en lambda
        existentes = SubmetodoPago.select(
            lambda s: s.metodo_pago.id == metodo_pago_id_check
        )
        existente = None
        for s in existentes:
            if s.nombre == nombre_submetodo:
                existente = s
                break
        if existente:
            raise HTTPException(status_code=400, detail=f"Ya existe un submétodo con el nombre '{submetodo_data['nombre']}' para este método de pago")
        
        submetodo = SubmetodoPago(
            metodo_pago=metodo,
            nombre=submetodo_data["nombre"],
            activo=submetodo_data.get("activo", True),
            orden=submetodo_data.get("orden", 0)
        )
        flush()
        
        return submetodo
    
    @db_session
    def actualizar_submetodo(self, submetodo_id: int, submetodo_data: dict, usuario_id: int) -> SubmetodoPago:
        """Actualiza un submétodo de pago (solo ADMIN)"""
        usuario = Usuario.get(id=usuario_id)
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        from src.models import Roles
        if usuario.rol != Roles.ADMIN:
            raise HTTPException(status_code=403, detail="Solo los administradores pueden actualizar submétodos de pago")
        
        submetodo = SubmetodoPago.get(id=submetodo_id)
        if not submetodo:
            raise HTTPException(status_code=404, detail="Submétodo de pago no encontrado")
        
        # Verificar que el nombre no esté duplicado si se cambia
        if "nombre" in submetodo_data and submetodo_data["nombre"] != submetodo.nombre:
            nuevo_nombre_sub = submetodo_data["nombre"]
            metodo_pago_id_check_sub = submetodo.metodo_pago.id
            # Usar select y filtrar en Python para evitar problemas con and en lambda
            existentes = SubmetodoPago.select(
                lambda s: s.metodo_pago.id == metodo_pago_id_check_sub
            )
            existente = None
            for s in existentes:
                if s.nombre == nuevo_nombre_sub and s.id != submetodo_id:
                    existente = s
                    break
            if existente:
                raise HTTPException(status_code=400, detail=f"Ya existe un submétodo con el nombre '{submetodo_data['nombre']}' para este método de pago")
        
        if "nombre" in submetodo_data:
            submetodo.nombre = submetodo_data["nombre"]
        if "activo" in submetodo_data:
            submetodo.activo = submetodo_data["activo"]
        if "orden" in submetodo_data:
            submetodo.orden = submetodo_data["orden"]
        
        flush()
        
        return submetodo
    
    @db_session
    def validar_metodo_pago(self, metodo_id: int, submetodo_id: Optional[int], sucursal_id: int) -> tuple:
        """Valida que el método y submétodo pertenezcan a la sucursal y sean válidos"""
        metodo = MetodoPagoConfigurable.get(id=metodo_id)
        if not metodo:
            raise HTTPException(status_code=404, detail="Método de pago no encontrado")
        
        if metodo.sucursal.id != sucursal_id:
            raise HTTPException(status_code=400, detail="El método de pago no pertenece a la sucursal especificada")
        
        if not metodo.activo:
            raise HTTPException(status_code=400, detail="El método de pago está inactivo")
        
        submetodo = None
        if submetodo_id:
            submetodo = SubmetodoPago.get(id=submetodo_id)
            if not submetodo:
                raise HTTPException(status_code=404, detail="Submétodo de pago no encontrado")
            
            if submetodo.metodo_pago.id != metodo_id:
                raise HTTPException(status_code=400, detail="El submétodo no pertenece al método de pago especificado")
            
            if not submetodo.activo:
                raise HTTPException(status_code=400, detail="El submétodo de pago está inactivo")
        
        # Si el método tiene submétodos, debe seleccionarse uno
        if metodo.tiene_submetodos and not submetodo:
            raise HTTPException(status_code=400, detail=f"El método '{metodo.nombre}' requiere seleccionar un submétodo")
        
        return metodo, submetodo
